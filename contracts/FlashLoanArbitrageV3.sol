// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Aave V3 Interfaces ───────────────────────────────────────────────────────

interface IPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

// ─── DEX Interfaces ──────────────────────────────────────────────────────────

/// @dev Uniswap V3 SwapRouter
interface ISwapRouterV3 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @dev SushiSwap / Uniswap V2-style router
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @dev Curve StableSwap (3pool / generic 2-coin pools)
interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}

// ─── Flash-Loan Receiver Interface ───────────────────────────────────────────

interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

// ─── Main Contract ────────────────────────────────────────────────────────────

/**
 * @title  FlashLoanArbitrageV3
 * @notice Cross-chain arbitrage contract using Aave V3 flash loans.
 *         Supports Uniswap V3, SushiSwap, and Curve as execution venues.
 * @dev    Deploy one instance per chain; supply chain-specific pool addresses
 *         via the constructor.  The owner triggers arbitrage off-chain and
 *         the profit (amount – premium) stays in this contract.
 */
contract FlashLoanArbitrageV3 is IFlashLoanSimpleReceiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────────────

    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    ISwapRouterV3   public uniswapV3Router;
    IUniswapV2Router public sushiswapRouter;

    // DEX identifier constants
    uint8 public constant DEX_UNISWAP_V3  = 1;
    uint8 public constant DEX_SUSHISWAP   = 2;
    uint8 public constant DEX_CURVE       = 3;

    // ── Events ────────────────────────────────────────────────────────────────

    event FlashLoanInitiated(address indexed asset, uint256 amount);
    event ArbExecuted(
        address indexed tokenBorrow,
        uint256 amountBorrowed,
        uint256 profit
    );
    event RouterUpdated(string dex, address newRouter);
    event ProfitWithdrawn(address indexed token, uint256 amount);

    // ── Custom Errors ─────────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidAmount();
    error InsufficientBalance(uint256 required, uint256 available);
    error SwapFailed(uint8 dex);
    error ZeroAddress();

    // ── Structs ───────────────────────────────────────────────────────────────

    struct ArbParams {
        uint8   dex1;           // first DEX identifier
        uint8   dex2;           // second DEX identifier
        address tokenBorrow;    // asset borrowed from Aave
        address tokenIntermediate; // intermediate token for the arb route
        uint24  fee1;           // Uni V3 pool fee tier for leg 1 (500, 3000, 10000)
        uint24  fee2;           // Uni V3 pool fee tier for leg 2
        address curvePool1;     // Curve pool address (if dex1 == DEX_CURVE)
        address curvePool2;     // Curve pool address (if dex2 == DEX_CURVE)
        int128  curveI1;        // Curve coin index in
        int128  curveJ1;        // Curve coin index out
        int128  curveI2;
        int128  curveJ2;
        uint256 amountOutMin1;  // minimum out for leg 1
        uint256 amountOutMin2;  // minimum out for leg 2
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param provider        Aave V3 PoolAddressesProvider for this chain.
     * @param _uniswapV3      Uniswap V3 SwapRouter address.
     * @param _sushiswap      SushiSwap (V2) Router address.
     */
    constructor(
        address provider,
        address _uniswapV3,
        address _sushiswap
    ) Ownable(msg.sender) {
        if (provider == address(0) || _uniswapV3 == address(0) || _sushiswap == address(0))
            revert ZeroAddress();

        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        uniswapV3Router  = ISwapRouterV3(_uniswapV3);
        sushiswapRouter  = IUniswapV2Router(_sushiswap);
    }

    // ── Owner functions ───────────────────────────────────────────────────────

    /**
     * @notice Update the Uniswap V3 router address.
     */
    function setUniswapV3Router(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        uniswapV3Router = ISwapRouterV3(router);
        emit RouterUpdated("UniswapV3", router);
    }

    /**
     * @notice Update the SushiSwap router address.
     */
    function setSushiswapRouter(address router) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        sushiswapRouter = IUniswapV2Router(router);
        emit RouterUpdated("Sushiswap", router);
    }

    /**
     * @notice Withdraw accumulated profit / stuck tokens to owner.
     */
    function withdrawToken(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert InvalidAmount();
        IERC20(token).safeTransfer(owner(), bal);
        emit ProfitWithdrawn(token, bal);
    }

    /**
     * @notice Withdraw ETH to owner.
     */
    function withdrawETH() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal == 0) revert InvalidAmount();
        (bool ok, ) = owner().call{value: bal}("");
        require(ok, "ETH transfer failed");
    }

    // ── Flash Loan Entry Point ────────────────────────────────────────────────

    /**
     * @notice Initiate an Aave V3 flash loan to fund an arbitrage.
     * @param asset      Token to borrow.
     * @param amount     Amount to borrow (in token's native decimals).
     * @param arbParams  ABI-encoded ArbParams struct.
     */
    function executeArbitrage(
        address asset,
        uint256 amount,
        bytes calldata arbParams
    ) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();

        address[] memory assets  = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes   = new uint256[](1);

        assets[0]  = asset;
        amounts[0] = amount;
        modes[0]   = 0; // no-debt mode → full repayment required

        emit FlashLoanInitiated(asset, amount);

        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            arbParams,
            0 // referral code
        );
    }

    // ── IFlashLoanSimpleReceiver ──────────────────────────────────────────────

    /**
     * @notice Called by the Aave V3 Pool after transferring funds.
     *         Executes the two-leg arbitrage and repays the loan + premium.
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(POOL))  revert Unauthorized();
        if (initiator  != address(this))  revert Unauthorized();

        ArbParams memory arb = abi.decode(params, (ArbParams));

        uint256 amountBorrowed  = amounts[0];
        uint256 amountOwed      = amountBorrowed + premiums[0];
        address tokenBorrow     = assets[0];

        // ── Leg 1: tokenBorrow → tokenIntermediate ──────────────────────────
        uint256 intermediateReceived = _swap(
            arb.dex1,
            tokenBorrow,
            arb.tokenIntermediate,
            amountBorrowed,
            arb.amountOutMin1,
            arb.fee1,
            arb.curvePool1,
            arb.curveI1,
            arb.curveJ1
        );

        // ── Leg 2: tokenIntermediate → tokenBorrow ──────────────────────────
        uint256 finalReceived = _swap(
            arb.dex2,
            arb.tokenIntermediate,
            tokenBorrow,
            intermediateReceived,
            arb.amountOutMin2,
            arb.fee2,
            arb.curvePool2,
            arb.curveI2,
            arb.curveJ2
        );

        // ── Repay ────────────────────────────────────────────────────────────
        uint256 balance = IERC20(tokenBorrow).balanceOf(address(this));
        if (balance < amountOwed)
            revert InsufficientBalance(amountOwed, balance);

        IERC20(tokenBorrow).safeApprove(address(POOL), amountOwed);

        uint256 profit = balance - amountOwed;
        emit ArbExecuted(tokenBorrow, amountBorrowed, profit);

        return true;
    }

    // ── Internal Swap Router ─────────────────────────────────────────────────

    function _swap(
        uint8   dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24  feeTier,
        address curvePool,
        int128  curveI,
        int128  curveJ
    ) internal returns (uint256 amountOut) {
        if (dex == DEX_UNISWAP_V3) {
            IERC20(tokenIn).safeApprove(address(uniswapV3Router), amountIn);
            try uniswapV3Router.exactInputSingle(
                ISwapRouterV3.ExactInputSingleParams({
                    tokenIn:           tokenIn,
                    tokenOut:          tokenOut,
                    fee:               feeTier,
                    recipient:         address(this),
                    deadline:          block.timestamp + 300,
                    amountIn:          amountIn,
                    amountOutMinimum:  amountOutMin,
                    sqrtPriceLimitX96: 0
                })
            ) returns (uint256 out) {
                amountOut = out;
            } catch {
                revert SwapFailed(dex);
            }
        } else if (dex == DEX_SUSHISWAP) {
            IERC20(tokenIn).safeApprove(address(sushiswapRouter), amountIn);
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            try sushiswapRouter.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300
            ) returns (uint256[] memory amounts) {
                amountOut = amounts[amounts.length - 1];
            } catch {
                revert SwapFailed(dex);
            }
        } else if (dex == DEX_CURVE) {
            if (curvePool == address(0)) revert ZeroAddress();
            IERC20(tokenIn).safeApprove(curvePool, amountIn);
            try ICurvePool(curvePool).exchange(curveI, curveJ, amountIn, amountOutMin)
            returns (uint256 out) {
                amountOut = out;
            } catch {
                revert SwapFailed(dex);
            }
        } else {
            revert SwapFailed(dex);
        }
    }

    // ── Receive ETH ──────────────────────────────────────────────────────────

    receive() external payable {}
}
