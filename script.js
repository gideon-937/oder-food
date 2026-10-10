
// ======================================
// API CONFIGURATION
// ======================================

const API_URL = "https://oder-food-2.onrender.com";

console.log("MAIN SCRIPT.JS IS WORKING");

// ======================================
// HTML ELEMENTS
// ======================================

const foodContainer = document.getElementById("food-container");
const cart = document.getElementById("cart");
const cartIcon = document.querySelector(".cart-icon");
const closeCart = document.getElementById("close-cart");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");
const checkoutBtn = document.getElementById("checkout-btn");
const payBtn = document.getElementById("pay-btn");
const paymentBox = document.getElementById("payment-box");
const phoneInput = document.getElementById("phone");
const paymentStatus = document.getElementById("payment-status");
const paymentStatusText = document.getElementById("payment-status-text");
const customerNameInput = document.getElementById("customer-name");

// ======================================
// CART AND PAYMENT STATE
// ======================================

const CART_STORAGE_KEY = "shoppingCart";
const PENDING_ORDER_KEY = "pendingFoodOrderId";
const PENDING_ORDER_TOKEN_KEY = "pendingFoodOrderStatusToken";
const PENDING_ORDER_HISTORY_KEY = "pendingFoodOrderHistory";

let shoppingCart = [];

let currentOrderId =
    localStorage.getItem(PENDING_ORDER_KEY) || null;

let currentOrderStatusToken =
    localStorage.getItem(PENDING_ORDER_TOKEN_KEY) || null;

// Remember whether the customer has entered checkout.
let checkoutStageActive = Boolean(currentOrderId);

let paymentPollingInterval = null;
let paymentRequestInProgress = false;
let statusCheckInProgress = false;
let stockRefreshInProgress = false;
let paymentPollingOrderId = null;

const foodStockMap = new Map();

// ======================================
// RESTORE SAVED CART
// ======================================

try {
    const savedCart = JSON.parse(
        localStorage.getItem(CART_STORAGE_KEY) || "[]"
    );

    shoppingCart = Array.isArray(savedCart)
        ? savedCart
            .filter(item =>
                item &&
                item.foodId &&
                Number.isSafeInteger(Number(item.quantity)) &&
                Number(item.quantity) >= 1
            )
            .map(item => ({
                ...item,
                foodId: String(item.foodId),
                quantity: Number(item.quantity),
                price: Number(item.price) || 0
            }))
        : [];
} catch (error) {
    console.error("Could not restore shopping cart:", error);
    shoppingCart = [];
}

// ======================================
// SAFE HTML TEXT
// ======================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ======================================
// SAVE CART AND PENDING ORDER
// ======================================

function saveCart() {
    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(shoppingCart)
    );
}

// Store the order ID and its private status token.
// Calling savePendingOrder(null) clears both values.

function savePendingOrder(orderId, statusToken = null) {
    currentOrderId = orderId ? String(orderId) : null;

    currentOrderStatusToken =
        currentOrderId &&
        typeof statusToken === "string" &&
        /^[a-f0-9]{64}$/i.test(statusToken)
            ? statusToken
            : null;

    if (currentOrderId) {
        localStorage.setItem(
            PENDING_ORDER_KEY,
            currentOrderId
        );
    } else {
        localStorage.removeItem(PENDING_ORDER_KEY);
    }

    if (currentOrderStatusToken) {
        localStorage.setItem(
            PENDING_ORDER_TOKEN_KEY,
            currentOrderStatusToken
        );
    } else {
        localStorage.removeItem(PENDING_ORDER_TOKEN_KEY);
    }
}

// ======================================
// ARCHIVE AN UNRESOLVED ORDER ID
// ======================================

// This records an order ID in browser history.
// It does not delete the database order or change payment status.

function archivePendingOrder(orderId) {
    if (!orderId) return;

    const id = String(orderId);
    let history = [];

    try {
        const saved = JSON.parse(
            localStorage.getItem(PENDING_ORDER_HISTORY_KEY) || "[]"
        );

        if (Array.isArray(saved)) {
            history = saved.filter(
                value => typeof value === "string"
            );
        }
    } catch (error) {
        console.error(
            "Could not read pending order history:",
            error
        );
    }

    if (!history.includes(id)) {
        history.push(id);
    }

    history = history.slice(-100);

    localStorage.setItem(
        PENDING_ORDER_HISTORY_KEY,
        JSON.stringify(history)
    );
}

// ======================================
// API HELPERS
// ======================================

async function fetchJSON(url, options = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        15000
    );

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                `Invalid server response (HTTP ${response.status}).`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed with HTTP ${response.status}.`
            );
        }

        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "The food server took too long to respond. Please try again."
            );
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function getFoodsFromResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.foods)) return data.foods;
    if (Array.isArray(data.data)) return data.data;

    return [];
}

function getPaymentStatus(data) {
    return String(
        data?.paymentStatus ??
        data?.order?.paymentStatus ??
        data?.status ??
        data?.order?.status ??
        ""
    ).trim().toLowerCase();
}

// ======================================
// STOCK HELPERS
// ======================================

function getStock(foodId) {
    const food = foodStockMap.get(String(foodId));

    if (
        !food ||
        food.stock === undefined ||
        food.stock === null ||
        food.stock === ""
    ) {
        return null;
    }

    const stock = Number(food.stock);

    if (!Number.isSafeInteger(stock) || stock < 0) {
        return null;
    }

    return stock;
}

function getStockMessage(stock) {
    if (stock === null) {
        return "Stock information unavailable";
    }

    if (stock === 0) {
        return "Out of stock";
    }

    return `${stock} ${stock === 1 ? "unit" : "units"} available`;
}

function getFood(foodId) {
    return foodStockMap.get(String(foodId)) || null;
}

function isFoodOrderable(food) {
    if (!food || food.available === false) return false;

    const stock = getStock(food._id);

    return stock !== null && stock > 0;
}

function syncCartStock() {
    shoppingCart.forEach(item => {
        const food = getFood(item.foodId);
        const stock = getStock(item.foodId);

        if (food) {
            item.name = food.name || item.name;
            item.price = Number(food.price) || item.price;
            item.image = food.image || item.image || "";
        }

        if (stock !== null) {
            item.stockLimit = stock;
        }
    });

    saveCart();
}

// ======================================
// FOOD IMAGE URL
// ======================================

function getFoodImageUrl(image) {
    if (!image) return "";

    image = String(image).trim();

    if (
        image.startsWith("https://") ||
        image.startsWith("http://") ||
        image.startsWith("data:")
    ) {
        return image;
    }

    image = image.replace(/\\/g, "/");

    if (image.includes("/uploads/")) {
        image = image.substring(
            image.indexOf("/uploads/")
        );
    }

    if (!image.startsWith("/")) {
        image = `/uploads/food/${image}`;
    }

    return `${API_URL}${image}`;
}

// ======================================
// LOAD FOODS
// ======================================

async function loadFoods() {
    try {
        const data = await fetchJSON(`${API_URL}/api/food`);
        const foods = getFoodsFromResponse(data);

        foodStockMap.clear();

        foods.forEach(food => {
            if (food && food._id) {
                foodStockMap.set(String(food._id), food);
            }
        });

        syncCartStock();
        displayFoods(foods);
        displayCart();

        return foods;
    } catch (error) {
        console.error("Food loading error:", error);

        if (foodContainer && foodStockMap.size === 0) {
            foodContainer.innerHTML = `
                <p>
                    Could not connect to the food server.
                    Please refresh the page.
                </p>
            `;
        }

        throw error;
    }
}

// ======================================
// REFRESH STOCK
// ======================================

async function refreshStock() {
    while (stockRefreshInProgress) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    stockRefreshInProgress = true;

    try {
        const data = await fetchJSON(`${API_URL}/api/food`);
        const foods = getFoodsFromResponse(data);

        foodStockMap.clear();

        foods.forEach(food => {
            if (food && food._id) {
                foodStockMap.set(String(food._id), food);
            }
        });

        syncCartStock();
        displayFoods(foods);
        displayCart();

        return foods;
    } finally {
        stockRefreshInProgress = false;
    }
}

// ======================================
// DISPLAY FOOD CARDS
// ======================================

function displayFoods(foods) {
    if (!foodContainer) return;

    if (!foods || foods.length === 0) {
        foodContainer.innerHTML =
            "<p>No food available at the moment.</p>";

        return;
    }

    foodContainer.innerHTML = "";

    foods.forEach(food => {
        const foodId = String(food._id);
        const imageUrl = getFoodImageUrl(food.image);
        const stock = getStock(foodId);
        const available = food.available !== false;

        const canOrder =
            available &&
            stock !== null &&
            stock > 0;

        const price = Number(food.price) || 0;

        const foodCard = document.createElement("div");
        foodCard.className = "hero";

        foodCard.innerHTML = `
            ${
                imageUrl
                    ? `<img
                        src="${escapeHTML(imageUrl)}"
                        alt="${escapeHTML(food.name)}"
                        class="food-image"
                        loading="lazy"
                        onerror="this.style.display='none';"
                    >`
                    : `<div class="no-image">No Image</div>`
            }

            <h1 class="price">
                KSh ${price.toLocaleString()}
            </h1>

            <p>${escapeHTML(food.name)}</p>

            <p>${escapeHTML(food.description || "")}</p>

            ${
                food.category
                    ? `<p>Category: ${escapeHTML(food.category)}</p>`
                    : ""
            }

            <p
                class="remaining-stock"
                data-stock-id="${escapeHTML(foodId)}"
                style="font-weight:bold;color:${
                    canOrder ? "#237a36" : "#c62828"
                }"
            >
                ${
                    !available
                        ? "Currently unavailable"
                        : getStockMessage(stock)
                }
            </p>

            <button
                type="button"
                class="add-cart-btn"
                data-id="${escapeHTML(foodId)}"
                ${canOrder ? "" : "disabled"}
            >
                ${
                    !available
                        ? "Unavailable"
                        : stock === 0
                            ? "Out of Stock"
                            : stock === null
                                ? "Stock Unavailable"
                                : "🛒 Add to Cart"
                }
            </button>
        `;

        foodContainer.appendChild(foodCard);
    });

    foodContainer.querySelectorAll(".add-cart-btn").forEach(button => {
        button.addEventListener("click", () => {
            if (!button.disabled) {
                addFoodToCart(button.dataset.id);
            }
        });
    });
}

// ======================================
// ADD FOOD TO CART
// ======================================

function addFoodToCart(foodId) {
    const food = getFood(foodId);

    if (!food) {
        alert("Food information is unavailable. Refresh the page.");
        return;
    }

    if (food.available === false) {
        alert("This food is currently unavailable.");
        return;
    }

    const stock = getStock(foodId);

    if (stock === null) {
        alert("Stock information is unavailable. Please refresh.");
        return;
    }

    if (stock < 1) {
        alert("Sorry, this food is out of stock.");
        return;
    }

    const existing = shoppingCart.find(
        item => String(item.foodId) === String(foodId)
    );

    if (existing) {
        if (existing.quantity >= stock) {
            alert(`Only ${stock} unit(s) are available.`);
            return;
        }

        existing.quantity++;
        existing.stockLimit = stock;
    } else {
        shoppingCart.push({
            foodId: String(food._id),
            name: food.name,
            price: Number(food.price) || 0,
            image: food.image || "",
            quantity: 1,
            stockLimit: stock
        });
    }

    saveCart();
    displayCart();

    if (cart) {
        cart.classList.add("active");
    }
}

// ======================================
// DISPLAY SHOPPING CART
// ======================================

function displayCart() {
    if (!cartItems || !cartTotal || !cartCount || !checkoutBtn) {
        return;
    }

    cartItems.innerHTML = "";

    if (shoppingCart.length === 0) {
        cartItems.innerHTML = "<p>Your basket is empty.</p>";

        cartTotal.textContent = "0";
        cartCount.textContent = "0";

        checkoutBtn.style.display =
            checkoutStageActive ? "none" : "block";

        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.5";
        checkoutBtn.style.cursor = "not-allowed";

        return;
    }

    let total = 0;
    let count = 0;

    shoppingCart.forEach((item, index) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const itemTotal = price * quantity;

        const stock = getStock(item.foodId);
        const food = getFood(item.foodId);

        const available = Boolean(
            food && food.available !== false
        );

        const imageUrl = getFoodImageUrl(item.image);

        total += itemTotal;
        count += quantity;

        const quantityAtLimit =
            stock !== null && quantity >= stock;

        const exceedsStock =
            stock === null || quantity > stock;

        const cartItem = document.createElement("div");
        cartItem.className = "cart-item";

        cartItem.innerHTML = `
            ${
                imageUrl
                    ? `<img
                        src="${escapeHTML(imageUrl)}"
                        alt="${escapeHTML(item.name)}"
                        class="cart-food-image"
                        onerror="this.style.display='none';"
                    >`
                    : ""
            }

            <div class="cart-item-details">
                <h4>${escapeHTML(item.name)}</h4>

                <p>KSh ${price.toLocaleString()}</p>

                <p
                    class="cart-stock-message"
                    style="font-size:13px;color:${
                        available && !exceedsStock
                            ? "#237a36"
                            : "#c62828"
                    }"
                >
                    ${
                        !available
                            ? "Currently unavailable"
                            : stock === null
                                ? "Stock information unavailable"
                                : `${stock} available now · ${quantity} in your basket`
                    }
                </p>

                <div class="quantity-controls">
                    <button
                        type="button"
                        class="decrease-btn"
                        data-index="${index}"
                        aria-label="Decrease quantity"
                    >−</button>

                    <span>${quantity}</span>

                    <button
                        type="button"
                        class="increase-btn"
                        data-index="${index}"
                        aria-label="Increase quantity"
                        ${
                            quantityAtLimit ||
                            !available ||
                            stock === null
                                ? "disabled"
                                : ""
                        }
                    >+</button>
                </div>

                ${
                    exceedsStock
                        ? `<p style="color:#c62828">
                            Please reduce the quantity to the available stock.
                        </p>`
                        : ""
                }

                <p>
                    Subtotal: KSh ${itemTotal.toLocaleString()}
                </p>

                <button
                    type="button"
                    class="remove-btn"
                    data-index="${index}"
                >Remove</button>
            </div>
        `;

        cartItems.appendChild(cartItem);
    });

    cartTotal.textContent = total.toLocaleString();
    cartCount.textContent = count;

    checkoutBtn.style.display =
        checkoutStageActive ? "none" : "block";

    const cartCanBeOrdered = shoppingCart.every(item => {
        const food = getFood(item.foodId);
        const stock = getStock(item.foodId);

        return (
            food &&
            food.available !== false &&
            stock !== null &&
            Number.isSafeInteger(Number(item.quantity)) &&
            Number(item.quantity) >= 1 &&
            Number(item.quantity) <= stock
        );
    });

    checkoutBtn.disabled = !cartCanBeOrdered;

    checkoutBtn.style.opacity =
        checkoutBtn.disabled ? "0.5" : "1";

    checkoutBtn.style.cursor =
        checkoutBtn.disabled ? "not-allowed" : "pointer";

    // INCREASE QUANTITY

    cartItems.querySelectorAll(".increase-btn").forEach(button => {
        button.addEventListener("click", async () => {
            if (button.disabled) return;

            button.disabled = true;

            try {
                await refreshStock();

                const index = Number(button.dataset.index);
                const item = shoppingCart[index];

                if (!item) return;

                const food = getFood(item.foodId);
                const stock = getStock(item.foodId);

                if (!food || food.available === false) {
                    alert("This food is currently unavailable.");
                    return;
                }

                if (stock === null) {
                    alert("Could not confirm stock. Please try again.");
                    return;
                }

                if (item.quantity >= stock) {
                    alert(`Only ${stock} unit(s) are available.`);
                    return;
                }

                item.quantity++;
                item.stockLimit = stock;

                saveCart();
                displayCart();
            } catch (error) {
                console.error("Quantity update error:", error);

                alert("Unable to refresh stock. Please try again.");
            } finally {
                displayCart();
            }
        });
    });

    // DECREASE QUANTITY

    cartItems.querySelectorAll(".decrease-btn").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.index);
            const item = shoppingCart[index];

            if (!item) return;

            if (item.quantity > 1) {
                item.quantity--;
            } else {
                shoppingCart.splice(index, 1);
            }

            saveCart();
            displayCart();
        });
    });

    // REMOVE ITEM

    cartItems.querySelectorAll(".remove-btn").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.index);

            if (!Number.isInteger(index)) return;

            shoppingCart.splice(index, 1);

            saveCart();
            displayCart();
        });
    });
}

// ======================================
// PAYMENT UI HELPERS
// ======================================

function showPaymentMessage(message) {
    if (paymentStatus) {
        paymentStatus.style.display = "block";
    }

    if (paymentStatusText) {
        paymentStatusText.textContent = message;
    }
}

function resetPaymentUI() {
    if (paymentBox) {
        paymentBox.style.display =
            currentOrderId ? "block" : "none";
    }

    if (paymentStatus) {
        paymentStatus.style.display = "none";
    }

    if (paymentStatusText) {
        paymentStatusText.textContent = "";
    }

    if (payBtn) {
        payBtn.disabled = false;

        payBtn.textContent = currentOrderId
            ? "Check Payment Status"
            : "Pay Now";
    }

    displayCart();
}

// ======================================
// STOP PAYMENT POLLING
// ======================================

function stopPaymentPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
    }

    paymentPollingOrderId = null;
}

// ======================================
// OPEN AND CLOSE CART
// ======================================

if (cartIcon && cart) {
    cartIcon.addEventListener("click", () => {
        cart.classList.add("active");
    });
}

if (closeCart && cart) {
    closeCart.addEventListener("click", () => {
        cart.classList.remove("active");

        if (currentOrderId && paymentBox) {
            paymentBox.style.display = "block";

            showPaymentMessage(
                "An order is awaiting payment confirmation. " +
                "Check its status before paying again."
            );
        } else {
            resetPaymentUI();
        }
    });
}

// ======================================
// VALIDATE CART AGAINST SERVER STOCK
// ======================================

function validateCartAgainstStock() {
    if (shoppingCart.length === 0) {
        throw new Error("Your shopping basket is empty.");
    }

    for (const item of shoppingCart) {
        const food = getFood(item.foodId);
        const stock = getStock(item.foodId);

        if (!food) {
            throw new Error(
                `${item.name} could not be found. Refresh your basket.`
            );
        }

        if (food.available === false) {
            throw new Error(
                `${item.name} is currently unavailable.`
            );
        }

        if (stock === null) {
            throw new Error(
                `Stock for ${item.name} could not be confirmed.`
            );
        }

        if (
            !Number.isSafeInteger(Number(item.quantity)) ||
            Number(item.quantity) < 1
        ) {
            throw new Error(
                `Invalid quantity for ${item.name}.`
            );
        }

        if (Number(item.quantity) > stock) {
            throw new Error(
                `Only ${stock} unit(s) of ${item.name} are available. ` +
                "Please update your basket."
            );
        }
    }

    return true;
}

// ======================================
// CHECKOUT
// ======================================

if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
        if (paymentRequestInProgress || statusCheckInProgress) {
            showPaymentMessage(
                "Please wait for the current request to finish."
            );
            return;
        }

        if (shoppingCart.length === 0) {
            alert(
                "Your shopping basket is empty. Add food before checkout."
            );
            return;
        }

        checkoutStageActive = true;
        checkoutBtn.style.display = "none";
        checkoutBtn.disabled = true;

        try {
            // Never create another order while an earlier order is unresolved.

            if (currentOrderId) {
                if (paymentBox) {
                    paymentBox.style.display = "block";
                }

                showPaymentMessage(
                    "Your previous order is still being checked. " +
                    "Do not pay again until its payment status is confirmed."
                );

                await checkCurrentPaymentStatus();
                return;
            }

            await refreshStock();
            validateCartAgainstStock();

            if (paymentBox) {
                paymentBox.style.display = "block";
            }

            if (paymentStatus) {
                paymentStatus.style.display = "none";
            }

            if (paymentStatusText) {
                paymentStatusText.textContent = "";
            }

            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = "Pay Now";
            }

            showPaymentMessage(
                "Your basket is ready. Enter your details to continue."
            );

            if (customerNameInput) {
                customerNameInput.focus();
            }
        } catch (error) {
            console.error("Checkout error:", error);

            if (!currentOrderId) {
                checkoutStageActive = false;

                if (paymentBox) {
                    paymentBox.style.display = "none";
                }
            } else {
                checkoutStageActive = true;
            }

            alert(
                error.message ||
                "Could not verify food stock. Please try again."
            );
        } finally {
            displayCart();
        }
    });
}

// ======================================
// HANDLE CONFIRMED PAYMENT SUCCESS
// ======================================

async function handlePaymentSuccess() {
    stopPaymentPolling();

    shoppingCart = [];
    saveCart();

    // Clears both the order ID and status token.
    savePendingOrder(null);

    checkoutStageActive = false;
    paymentRequestInProgress = false;
    statusCheckInProgress = false;

    if (cart) {
        cart.classList.remove("active");
    }

    if (paymentBox) {
        paymentBox.style.display = "none";
    }

    if (paymentStatus) {
        paymentStatus.style.display = "none";
    }

    if (phoneInput) {
        phoneInput.value = "";
    }

    if (customerNameInput) {
        customerNameInput.value = "";
    }

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Pay Now";
    }

    displayCart();

    try {
        await refreshStock();
    } catch (error) {
        console.error(
            "Could not refresh stock after payment:",
            error
        );
    }

    alert("Payment successful! Your order has been received.");
}

// ======================================
// HANDLE CONFIRMED PAYMENT FAILURE
// ======================================

async function handlePaymentFailure(reason) {
    stopPaymentPolling();

    // Only call this after the backend confirms failure or cancellation.
    savePendingOrder(null);

    checkoutStageActive = false;
    paymentRequestInProgress = false;
    statusCheckInProgress = false;

    showPaymentMessage(
        (reason || "Payment failed.") +
        " You can try checkout again after stock has refreshed."
    );

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Pay Now";
    }

    try {
        await refreshStock();
    } catch (error) {
        console.error(
            "Stock refresh after failure failed:",
            error
        );
    }

    displayCart();
}

// ======================================
// CHECK CURRENT PAYMENT STATUS
// ======================================

async function checkCurrentPaymentStatus() {
    if (!currentOrderId) {
        showPaymentMessage(
            "No pending order was found. You can continue checkout."
        );

        return;
    }

    // A legacy order may have an ID but no status token.
    // Do not call the protected endpoint without the token.
    if (!currentOrderStatusToken) {
        stopPaymentPolling();

        showPaymentMessage(
            "This order has no saved security token, possibly because it " +
            "was created before the security update. Do not pay again or " +
            "create another order. Contact the hotel to verify its payment status."
        );

        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = "Order Needs Verification";
        }

        return;
    }

    if (statusCheckInProgress) return;

    statusCheckInProgress = true;

    const orderIdBeingChecked = String(currentOrderId);

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = "Checking...";
    }

    showPaymentMessage(
        "Checking your M-Pesa payment status..."
    );

    try {
        const data = await fetchJSON(
            `${API_URL}/api/orders/payment-status/` +
            encodeURIComponent(orderIdBeingChecked),
            {
                headers: {
                    "X-Order-Status-Token": currentOrderStatusToken
                }
            }
        );

        if (String(currentOrderId) !== orderIdBeingChecked) {
            return;
        }

        const status = getPaymentStatus(data);

        if (status === "paid") {
            await handlePaymentSuccess();
            return;
        }

        if (status === "failed" || status === "cancelled") {
            await handlePaymentFailure(
                data.failureReason ||
                data.order?.failureReason ||
                "Payment failed or was cancelled."
            );

            return;
        }

        if (
            status !== "pending" &&
            status !== "processing" &&
            status !== ""
        ) {
            console.warn(
                "Unrecognized payment status:",
                data
            );
        }

        showPaymentMessage(
            "Payment is not confirmed yet. We will check the existing order. " +
            "Do not make another payment while its outcome is unknown."
        );

        startPaymentPolling(orderIdBeingChecked);
    } catch (error) {
        console.error(
            "Payment status check failed:",
            error
        );

        showPaymentMessage(
            "We could not retrieve your payment status. Check your connection " +
            "and try Check Payment Status again. Do not assume payment failed."
        );

        if (payBtn) {
            payBtn.disabled = false;
            payBtn.textContent = "Check Payment Status";
        }
    } finally {
        statusCheckInProgress = false;
    }
}

// ======================================
// M-PESA PAYMENT BUTTON
// ======================================

if (payBtn) {
    payBtn.addEventListener("click", async () => {
        // Existing orders must be checked, never charged again here.

        if (currentOrderId) {
            await checkCurrentPaymentStatus();
            return;
        }

        if (
            paymentRequestInProgress ||
            statusCheckInProgress
        ) {
            return;
        }

        const customerName =
            customerNameInput?.value.trim() || "";

        const phone =
            phoneInput?.value.trim() || "";

        if (!customerName) {
            alert(
                "Please enter your name before making payment."
            );

            customerNameInput?.focus();
            return;
        }

        if (!/^07\d{8}$/.test(phone)) {
            alert(
                "Enter a valid M-Pesa number starting with 07, " +
                "e.g. 0712345678."
            );

            phoneInput?.focus();
            return;
        }

        if (shoppingCart.length === 0) {
            alert("Your shopping basket is empty.");
            return;
        }

        const mpesaPhone = "254" + phone.substring(1);

        paymentRequestInProgress = true;

        payBtn.disabled = true;
        payBtn.textContent = "Processing...";

        showPaymentMessage("Checking food stock...");

        try {
            await refreshStock();
            validateCartAgainstStock();

            showPaymentMessage("Creating your order...");

            // Create the order first.
            const orderData = await fetchJSON(
                `${API_URL}/api/orders`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        customer: {
                            name: customerName,
                            phone: mpesaPhone
                        },

                        items: shoppingCart.map(item => ({
                            foodId: String(item.foodId),
                            quantity: Number(item.quantity)
                        }))
                    })
                }
            );

            const order = orderData.order || orderData;

            if (!order._id) {
                throw new Error(
                    "The server did not return an order ID. " +
                    "Verify the order before trying again."
                );
            }

            // Require the private token before initiating any payment.
            // If it is missing, keep the order ID for staff reconciliation
            // and DO NOT send an STK Push.

            if (
                typeof orderData.statusToken !== "string" ||
                !/^[a-f0-9]{64}$/i.test(orderData.statusToken)
            ) {
                savePendingOrder(order._id);

                showPaymentMessage(
                    "Your order was created, but its secure status token " +
                    "was not returned. No payment request will be sent. " +
                    "Do not create another order or pay again. " +
                    "Contact the hotel to verify this order."
                );

                if (payBtn) {
                    payBtn.disabled = true;
                    payBtn.textContent = "Order Needs Verification";
                }

                return;
            }

            // Save the ID and token before any payment request.
            savePendingOrder(order._id, orderData.statusToken);

            showPaymentMessage(
                "Order created. Preparing your M-Pesa request..."
            );

            try {
                await refreshStock();
            } catch (refreshError) {
                console.error(
                    "Stock refresh after reservation failed:",
                    refreshError
                );
            }

            const totalPrice = Number(order.totalPrice);

            if (
                !Number.isFinite(totalPrice) ||
                totalPrice <= 0
            ) {
                throw new Error(
                    "The server returned an invalid order total. " +
                    "Check this order's status before retrying."
                );
            }

            showPaymentMessage(
                "Sending the M-Pesa request. Check your phone for the PIN prompt..."
            );

            const paymentData = await fetchJSON(
                `${API_URL}/api/mpesa/stkpush`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        phone: mpesaPhone,
                        amount: totalPrice,
                        orderId: currentOrderId
                    })
                }
            );

            if (paymentData.success === false) {
                throw new Error(
                    paymentData.message ||
                    "The payment request was not confirmed."
                );
            }

            showPaymentMessage(
                "Check your phone for the M-Pesa PIN prompt. " +
                "Waiting for confirmation..."
            );

            startPaymentPolling(currentOrderId);
        } catch (error) {
            console.error("PAYMENT ERROR:", error);

            showPaymentMessage(
                `${error.message || "An error occurred."} ` +
                (
                    currentOrderId
                        ? "Check the existing order's status before trying again."
                        : "You can correct the issue and try checkout again."
                )
            );

            if (currentOrderId) {
                // The STK request may have reached Safaricom even if
                // the browser received an error. Never resend it here.

                if (currentOrderStatusToken) {
                    if (payBtn) {
                        payBtn.disabled = false;
                        payBtn.textContent = "Check Payment Status";
                    }

                    startPaymentPolling(currentOrderId);
                } else if (payBtn) {
                    payBtn.disabled = true;
                    payBtn.textContent = "Order Needs Verification";
                }
            } else {
                if (payBtn) {
                    payBtn.disabled = false;
                    payBtn.textContent = "Pay Now";
                }
            }
        } finally {
            paymentRequestInProgress = false;
        }
    });
}

// ======================================
// PAYMENT STATUS POLLING
// ======================================

function startPaymentPolling(orderId) {
    if (!orderId) return;

    // Never poll without the private status token.
    if (!currentOrderStatusToken) {
        stopPaymentPolling();

        showPaymentMessage(
            "Secure payment-status verification is unavailable for this " +
            "order. Do not pay again. Contact the hotel to reconcile the order."
        );

        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = "Order Needs Verification";
        }

        return;
    }

    const id = String(orderId);

    if (
        paymentPollingInterval &&
        paymentPollingOrderId === id
    ) {
        return;
    }

    stopPaymentPolling();

    paymentPollingOrderId = id;

    let attempts = 0;
    const maxAttempts = 60;
    const intervalMs = 3000;
    let requestRunning = false;

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = "Awaiting Confirmation";
    }

    showPaymentMessage(
        "Waiting for M-Pesa payment confirmation..."
    );

    paymentPollingInterval = setInterval(async () => {
        if (requestRunning) return;

        // Stop if the active order changed.
        if (String(currentOrderId) !== id) {
            stopPaymentPolling();
            return;
        }

        // Stop if the token is missing.
        if (!currentOrderStatusToken) {
            stopPaymentPolling();

            showPaymentMessage(
                "The security token is unavailable. Do not pay again. " +
                "Contact the hotel to verify this order."
            );

            if (payBtn) {
                payBtn.disabled = true;
                payBtn.textContent = "Order Needs Verification";
            }

            return;
        }

        requestRunning = true;
        attempts++;

        try {
            const data = await fetchJSON(
                `${API_URL}/api/orders/payment-status/` +
                encodeURIComponent(id),
                {
                    headers: {
                        "X-Order-Status-Token": currentOrderStatusToken
                    }
                }
            );

            if (String(currentOrderId) !== id) {
                return;
            }

            const status = getPaymentStatus(data);

            if (status === "paid") {
                stopPaymentPolling();

                await handlePaymentSuccess();
                return;
            }

            if (
                status === "failed" ||
                status === "cancelled"
            ) {
                stopPaymentPolling();

                await handlePaymentFailure(
                    data.failureReason ||
                    data.order?.failureReason ||
                    "Payment failed or was cancelled."
                );

                return;
            }

            showPaymentMessage(
                "Waiting for M-Pesa confirmation. " +
                "If this takes too long, you can check the status again."
            );
        } catch (error) {
            console.error(
                "Payment status polling error:",
                error
            );

            showPaymentMessage(
                "We temporarily could not check your payment status. " +
                "Your order is saved; do not pay again until its status is confirmed."
            );
        } finally {
            requestRunning = false;
        }

        if (
            attempts >= maxAttempts &&
            String(currentOrderId) === id
        ) {
            stopPaymentPolling();

            showPaymentMessage(
                "Confirmation is taking longer than expected. " +
                "Check your M-Pesa messages, then click Check Payment Status. " +
                "The payment has NOT been assumed to have failed."
            );

            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = "Check Payment Status";
            }

            paymentRequestInProgress = false;
        }
    }, intervalMs);
}

// ======================================
// INITIALIZE
// ======================================

displayCart();

loadFoods().catch(() => {
    // The loading error is already logged and displayed.
});

if (currentOrderId) {
    if (paymentBox) {
        paymentBox.style.display = "block";
    }

    if (checkoutBtn) {
        checkoutBtn.style.display = "none";
    }

    showPaymentMessage(
        "An order is awaiting payment confirmation. Checking its status..."
    );

    if (currentOrderStatusToken) {
        startPaymentPolling(currentOrderId);
    } else {
        stopPaymentPolling();

        showPaymentMessage(
            "This order may have been created before the security update. " +
            "Its status cannot be checked automatically because its security " +
            "token is missing. Do not pay again or create another order. " +
            "Contact the hotel to verify the existing order."
        );

        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = "Order Needs Verification";
        }
    }
}

// ======================================
// REFRESH FOOD AND STOCK EVERY 30 SECONDS
// ======================================

setInterval(() => {
    loadFoods().catch(error => {
        console.error(
            "Automatic food refresh failed:",
            error
        );
    });
}, 30000);
