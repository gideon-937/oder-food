
"use strict";

// ======================================
// API CONFIGURATION
// ======================================

const API_URL = "https://oder-food-2.onrender.com";

console.log("CUSTOMER SCRIPT.JS IS WORKING");

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
// STORAGE KEYS
// ======================================

const CART_STORAGE_KEY = "shoppingCart";
const PENDING_ORDER_KEY = "pendingFoodOrderId";
const PENDING_PHONE_KEY = "pendingFoodOrderPhone";

let shoppingCart = [];
let currentOrderId = localStorage.getItem(PENDING_ORDER_KEY) || null;
let currentOrderPhone = localStorage.getItem(PENDING_PHONE_KEY) || null;

let checkoutStageActive = Boolean(currentOrderId);
let paymentPollingInterval = null;
let paymentPollingOrderId = null;
let paymentRequestInProgress = false;
let statusCheckInProgress = false;
let stockRefreshInProgress = false;

const foodStockMap = new Map();

// ======================================
// RESTORE CART
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
    console.error("Could not restore cart:", error);
    shoppingCart = [];
}

// ======================================
// SAFE HTML
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
// STORAGE HELPERS
// ======================================

function saveCart() {
    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(shoppingCart)
    );
}

function savePendingOrder(orderId, phone = null) {
    currentOrderId = orderId ? String(orderId) : null;
    currentOrderPhone = currentOrderId && phone
        ? String(phone)
        : null;

    if (currentOrderId) {
        localStorage.setItem(PENDING_ORDER_KEY, currentOrderId);
    } else {
        localStorage.removeItem(PENDING_ORDER_KEY);
    }

    if (currentOrderPhone) {
        localStorage.setItem(PENDING_PHONE_KEY, currentOrderPhone);
    } else {
        localStorage.removeItem(PENDING_PHONE_KEY);
    }
}

// Remove old frontend token data left by the previous version.
// This does not change or delete any database orders.
localStorage.removeItem("pendingFoodOrderStatusToken");

// ======================================
// API HELPERS
// ======================================

async function fetchJSON(url, options = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        const contentType = response.headers.get("content-type") || "";

        let data;

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const body = await response.text();

            throw new Error(
                `Expected JSON from server (HTTP ${response.status}). ` +
                body.slice(0, 150)
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
                "The server took too long to respond. Please try again."
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

function normalizeKenyanPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    if (/^07\d{8}$/.test(digits)) {
        return "254" + digits.substring(1);
    }

    if (/^01\d{8}$/.test(digits)) {
        return "254" + digits.substring(1);
    }

    if (/^254[17]\d{8}$/.test(digits)) {
        return digits;
    }

    return null;
}

// ======================================
// STOCK HELPERS
// ======================================

function getFood(foodId) {
    return foodStockMap.get(String(foodId)) || null;
}

function getStock(foodId) {
    const food = getFood(foodId);

    if (
        !food ||
        food.stock === undefined ||
        food.stock === null ||
        food.stock === ""
    ) {
        return null;
    }

    const stock = Number(food.stock);

    return Number.isSafeInteger(stock) && stock >= 0
        ? stock
        : null;
}

function getStockMessage(stock) {
    if (stock === null) return "Stock information unavailable";
    if (stock === 0) return "Out of stock";

    return `${stock} ${stock === 1 ? "unit" : "units"} available`;
}

function syncCartStock() {
    shoppingCart.forEach(item => {
        const food = getFood(item.foodId);

        if (food) {
            item.name = food.name || item.name;
            item.price = Number(food.price) || item.price;
            item.image = food.image || item.image || "";
        }

        const stock = getStock(item.foodId);

        if (stock !== null) {
            item.stockLimit = stock;
        }
    });

    saveCart();
}

// ======================================
// IMAGE URLS
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
        image = image.substring(image.indexOf("/uploads/"));
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
                <p>Could not load food from the server.</p>
                <button type="button" id="retry-food-loading">
                    Try Again
                </button>
            `;

            document
                .getElementById("retry-food-loading")
                ?.addEventListener("click", () => {
                    loadFoods().catch(console.error);
                });
        }

        throw error;
    }
}

async function refreshStock() {
    if (stockRefreshInProgress) {
        return loadFoods();
    }

    stockRefreshInProgress = true;

    try {
        return await loadFoods();
    } finally {
        stockRefreshInProgress = false;
    }
}

// ======================================
// DISPLAY FOOD CARDS
// ======================================

function displayFoods(foods) {
    if (!foodContainer) {
        console.error(
            'Missing "#food-container" in the customer HTML page.'
        );
        return;
    }

    if (!foods.length) {
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
        const canOrder = available && stock !== null && stock > 0;
        const price = Number(food.price) || 0;

        const card = document.createElement("div");
        card.className = "hero";

        card.innerHTML = `
            ${
                imageUrl
                    ? `<img
                        src="${escapeHTML(imageUrl)}"
                        alt="${escapeHTML(food.name)}"
                        class="food-image"
                        loading="lazy"
                    >`
                    : `<div class="no-image">No Image</div>`
            }

            <h2 class="price">KSh ${price.toLocaleString()}</h2>
            <p>${escapeHTML(food.name)}</p>
            <p>${escapeHTML(food.description || "")}</p>

            ${
                food.category
                    ? `<p>Category: ${escapeHTML(food.category)}</p>`
                    : ""
            }

            <p class="remaining-stock" style="font-weight:bold">
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
                ${canOrder ? "🛒 Add to Cart" : "Unavailable"}
            </button>
        `;

        const image = card.querySelector("img");

        if (image) {
            image.addEventListener("error", () => {
                image.style.display = "none";
            });
        }

        card.querySelector(".add-cart-btn")
            ?.addEventListener("click", event => {
                if (!event.currentTarget.disabled) {
                    addFoodToCart(foodId);
                }
            });

        foodContainer.appendChild(card);
    });
}

// ======================================
// ADD FOOD TO CART
// ======================================

function addFoodToCart(foodId) {
    const food = getFood(foodId);

    if (!food || food.available === false) {
        alert("This food is currently unavailable.");
        return;
    }

    const stock = getStock(foodId);

    if (stock === null) {
        alert("Stock information is unavailable. Refresh the page.");
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
    cart?.classList.add("active");
}

// ======================================
// DISPLAY CART
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
        return;
    }

    let total = 0;
    let count = 0;

    shoppingCart.forEach((item, index) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const subtotal = quantity * price;
        const stock = getStock(item.foodId);
        const food = getFood(item.foodId);
        const available = Boolean(food && food.available !== false);
        const imageUrl = getFoodImageUrl(item.image);

        total += subtotal;
        count += quantity;

        const exceedsStock = stock === null || quantity > stock;

        const row = document.createElement("div");
        row.className = "cart-item";

        row.innerHTML = `
            ${
                imageUrl
                    ? `<img
                        src="${escapeHTML(imageUrl)}"
                        alt="${escapeHTML(item.name)}"
                        class="cart-food-image"
                    >`
                    : ""
            }

            <div class="cart-item-details">
                <h4>${escapeHTML(item.name)}</h4>
                <p>KSh ${price.toLocaleString()}</p>

                <p class="cart-stock-message">
                    ${
                        !available
                            ? "Currently unavailable"
                            : stock === null
                                ? "Stock information unavailable"
                                : `${stock} available now · ${quantity} in your basket`
                    }
                </p>

                <div class="quantity-controls">
                    <button type="button" class="decrease-btn"
                        data-index="${index}">−</button>

                    <span>${quantity}</span>

                    <button type="button" class="increase-btn"
                        data-index="${index}"
                        ${
                            !available ||
                            stock === null ||
                            quantity >= stock
                                ? "disabled"
                                : ""
                        }>+</button>
                </div>

                ${
                    exceedsStock
                        ? `<p>Please reduce the quantity to available stock.</p>`
                        : ""
                }

                <p>Subtotal: KSh ${subtotal.toLocaleString()}</p>

                <button type="button" class="remove-btn"
                    data-index="${index}">Remove</button>
            </div>
        `;

        row.querySelector("img")?.addEventListener("error", event => {
            event.currentTarget.style.display = "none";
        });

        row.querySelector(".increase-btn")
            ?.addEventListener("click", async event => {
                if (event.currentTarget.disabled) return;

                try {
                    await refreshStock();

                    const currentItem = shoppingCart[index];
                    if (!currentItem) return;

                    const currentFood = getFood(currentItem.foodId);
                    const currentStock = getStock(currentItem.foodId);

                    if (
                        !currentFood ||
                        currentFood.available === false ||
                        currentStock === null
                    ) {
                        alert("Could not confirm availability.");
                        return;
                    }

                    if (currentItem.quantity >= currentStock) {
                        alert(`Only ${currentStock} unit(s) are available.`);
                        return;
                    }

                    currentItem.quantity++;
                    saveCart();
                } catch (error) {
                    alert(error.message || "Could not refresh stock.");
                } finally {
                    displayCart();
                }
            });

        row.querySelector(".decrease-btn")
            ?.addEventListener("click", () => {
                const currentItem = shoppingCart[index];
                if (!currentItem) return;

                if (currentItem.quantity > 1) {
                    currentItem.quantity--;
                } else {
                    shoppingCart.splice(index, 1);
                }

                saveCart();
                displayCart();
            });

        row.querySelector(".remove-btn")
            ?.addEventListener("click", () => {
                shoppingCart.splice(index, 1);
                saveCart();
                displayCart();
            });

        cartItems.appendChild(row);
    });

    cartTotal.textContent = total.toLocaleString();
    cartCount.textContent = count;

    checkoutBtn.style.display =
        checkoutStageActive ? "none" : "block";

    const valid = shoppingCart.every(item => {
        const food = getFood(item.foodId);
        const stock = getStock(item.foodId);

        return food &&
            food.available !== false &&
            stock !== null &&
            Number.isSafeInteger(item.quantity) &&
            item.quantity >= 1 &&
            item.quantity <= stock;
    });

    checkoutBtn.disabled = !valid;
    checkoutBtn.style.opacity = valid ? "1" : "0.5";
}

// ======================================
// PAYMENT MESSAGES
// ======================================

function showPaymentMessage(message) {
    if (paymentStatus) paymentStatus.style.display = "block";
    if (paymentStatusText) paymentStatusText.textContent = message;
}

function stopPaymentPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }

    paymentPollingInterval = null;
    paymentPollingOrderId = null;
}

// ======================================
// CART OPEN/CLOSE
// ======================================

cartIcon?.addEventListener("click", () => {
    cart?.classList.add("active");
});

closeCart?.addEventListener("click", () => {
    cart?.classList.remove("active");

    if (currentOrderId) {
        if (paymentBox) paymentBox.style.display = "block";

        showPaymentMessage(
            "An order is awaiting payment confirmation. " +
            "Check its status before paying again."
        );
    }
});

// ======================================
// VALIDATE STOCK
// ======================================

function validateCartAgainstStock() {
    if (shoppingCart.length === 0) {
        throw new Error("Your shopping basket is empty.");
    }

    for (const item of shoppingCart) {
        const food = getFood(item.foodId);
        const stock = getStock(item.foodId);

        if (!food) {
            throw new Error(`${item.name} could not be found.`);
        }

        if (food.available === false) {
            throw new Error(`${item.name} is currently unavailable.`);
        }

        if (stock === null) {
            throw new Error(`Stock for ${item.name} could not be confirmed.`);
        }

        if (
            !Number.isSafeInteger(Number(item.quantity)) ||
            Number(item.quantity) < 1 ||
            Number(item.quantity) > stock
        ) {
            throw new Error(
                `Please check the quantity of ${item.name}. ` +
                `Available stock: ${stock}.`
            );
        }
    }
}

// ======================================
// CHECKOUT BUTTON
// ======================================

checkoutBtn?.addEventListener("click", async () => {
    if (paymentRequestInProgress || statusCheckInProgress) return;

    if (shoppingCart.length === 0) {
        alert("Your shopping basket is empty.");
        return;
    }

    checkoutStageActive = true;
    displayCart();

    if (currentOrderId) {
        if (paymentBox) paymentBox.style.display = "block";

        showPaymentMessage(
            "You already have an unresolved order. Check its payment " +
            "status before creating another order."
        );

        await checkCurrentPaymentStatus();
        return;
    }

    try {
        await refreshStock();
        validateCartAgainstStock();

        if (paymentBox) paymentBox.style.display = "block";

        showPaymentMessage(
            "Your basket is ready. Enter your name and M-Pesa number."
        );

        customerNameInput?.focus();
    } catch (error) {
        checkoutStageActive = false;
        displayCart();

        alert(error.message || "Could not verify stock.");
    }
});

// ======================================
// CONFIRMED PAYMENT SUCCESS
// ======================================

async function handlePaymentSuccess() {
    stopPaymentPolling();

    shoppingCart = [];
    saveCart();
    savePendingOrder(null);

    checkoutStageActive = false;
    paymentRequestInProgress = false;
    statusCheckInProgress = false;

    cart?.classList.remove("active");

    if (paymentBox) paymentBox.style.display = "none";
    if (paymentStatus) paymentStatus.style.display = "none";
    if (phoneInput) phoneInput.value = "";
    if (customerNameInput) customerNameInput.value = "";

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Pay Now";
    }

    displayCart();

    try {
        await refreshStock();
    } catch (error) {
        console.error("Stock refresh after payment failed:", error);
    }

    alert("Payment successful! Your order has been received.");
}

// ======================================
// CONFIRMED PAYMENT FAILURE
// ======================================

async function handlePaymentFailure(reason) {
    stopPaymentPolling();

    // Call this only after the server confirms failure or cancellation.
    savePendingOrder(null);

    checkoutStageActive = false;
    paymentRequestInProgress = false;
    statusCheckInProgress = false;

    showPaymentMessage(
        `${reason || "Payment failed or was cancelled."} ` +
        "You may try checkout again after confirming the previous request ended."
    );

    if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Pay Now";
    }

    try {
        await refreshStock();
    } catch (error) {
        console.error("Stock refresh after failure failed:", error);
    }

    displayCart();
}

// ======================================
// CHECK PAYMENT STATUS
// Requires a backend route that validates
// X-Customer-Phone against the order.
// ======================================

async function checkCurrentPaymentStatus() {
    if (!currentOrderId) {
        showPaymentMessage("There is no pending order to check.");
        return;
    }

    if (!currentOrderPhone) {
        showPaymentMessage(
            "The saved customer phone number is missing. " +
            "Contact the hotel to verify the existing order. Do not pay again."
        );

        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = "Order Needs Verification";
        }

        return;
    }

    if (statusCheckInProgress) return;

    statusCheckInProgress = true;

    const orderId = String(currentOrderId);

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = "Checking...";
    }

    showPaymentMessage("Checking the existing M-Pesa payment...");

    try {
        const data = await fetchJSON(
            `${API_URL}/api/orders/payment-status/${encodeURIComponent(orderId)}`,
            {
                headers: {
                    "X-Customer-Phone": currentOrderPhone
                }
            }
        );

        if (String(currentOrderId) !== orderId) return;

        const status = getPaymentStatus(data);

        if (status === "paid" || status === "success" || status === "completed") {
            await handlePaymentSuccess();
            return;
        }

        if (status === "failed" || status === "cancelled") {
            await handlePaymentFailure(
                data.failureReason ||
                data.order?.failureReason ||
                "The server confirmed that payment failed or was cancelled."
            );
            return;
        }

        showPaymentMessage(
            "Payment has not been confirmed yet. " +
            "Do not make another payment while the result is unknown."
        );

        startPaymentPolling(orderId);
    } catch (error) {
        console.error("Payment status check failed:", error);

        showPaymentMessage(
            `${error.message} If the backend still requires the old status token, ` +
            "the status route must be updated before this check can work. " +
            "Do not pay again while the outcome is unknown."
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

payBtn?.addEventListener("click", async () => {
    // Existing orders are checked, never charged again by this button.
    if (currentOrderId) {
        await checkCurrentPaymentStatus();
        return;
    }

    if (paymentRequestInProgress || statusCheckInProgress) return;

    const customerName = customerNameInput?.value.trim() || "";
    const phone = normalizeKenyanPhone(phoneInput?.value);

    if (!customerName) {
        alert("Please enter your name.");
        customerNameInput?.focus();
        return;
    }

    if (!phone) {
        alert(
            "Enter a valid Kenyan phone number, for example 0712345678."
        );
        phoneInput?.focus();
        return;
    }

    if (shoppingCart.length === 0) {
        alert("Your shopping basket is empty.");
        return;
    }

    paymentRequestInProgress = true;

    payBtn.disabled = true;
    payBtn.textContent = "Processing...";

    showPaymentMessage("Checking stock...");

    let orderCreated = false;

    try {
        await refreshStock();
        validateCartAgainstStock();

        showPaymentMessage("Creating your order...");

        const orderData = await fetchJSON(`${API_URL}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                customer: {
                    name: customerName,
                    phone
                },
                items: shoppingCart.map(item => ({
                    foodId: String(item.foodId),
                    quantity: Number(item.quantity)
                }))
            })
        });

        const order = orderData.order || orderData;

        if (!order._id) {
            throw new Error(
                "The server did not return an order ID. " +
                "Check the order with the hotel before retrying."
            );
        }

        // Save the order immediately so a browser/network error
        // cannot cause the customer to create another order blindly.
        savePendingOrder(order._id, phone);
        orderCreated = true;
        checkoutStageActive = true;

        if (paymentBox) paymentBox.style.display = "block";

        const totalPrice = Number(order.totalPrice);

        if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
            showPaymentMessage(
                "The order was created, but its total is invalid. " +
                "Do not create another order; contact the hotel."
            );
            return;
        }

        showPaymentMessage(
            "Sending the M-Pesa request. Check your phone for the PIN prompt..."
        );

        // Send one STK request for this order.
        // If the request times out, do not automatically send it again.
        const paymentData = await fetchJSON(`${API_URL}/api/mpesa/stkpush`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                phone,
                amount: totalPrice,
                orderId: String(order._id)
            })
        });

        if (paymentData.success === false) {
            showPaymentMessage(
                paymentData.message ||
                "The payment request was not confirmed. Check the existing order's status before retrying."
            );
        } else {
            showPaymentMessage(
                "M-Pesa request sent. Complete the prompt on your phone. " +
                "Waiting for confirmation..."
            );
        }

        startPaymentPolling(String(order._id));
    } catch (error) {
        console.error("PAYMENT ERROR:", error);

        showPaymentMessage(
            `${error.message || "An error occurred."} ` +
            (
                orderCreated
                    ? "The order has been saved. Check its status before taking any further payment action."
                    : "No order ID was saved by this browser. Verify the server before trying again."
            )
        );

        if (currentOrderId) {
            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = "Check Payment Status";
            }
        } else if (payBtn) {
            payBtn.disabled = false;
            payBtn.textContent = "Pay Now";
        }
    } finally {
        paymentRequestInProgress = false;
    }
});

// ======================================
// PAYMENT STATUS POLLING
// ======================================

function startPaymentPolling(orderId) {
    if (!orderId || !currentOrderPhone) return;

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
    let requestRunning = false;

    const maxAttempts = 60;
    const intervalMs = 3000;

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = "Awaiting Confirmation";
    }

    paymentPollingInterval = setInterval(async () => {
        if (requestRunning) return;

        if (String(currentOrderId) !== id) {
            stopPaymentPolling();
            return;
        }

        requestRunning = true;
        attempts++;

        try {
            const data = await fetchJSON(
                `${API_URL}/api/orders/payment-status/${encodeURIComponent(id)}`,
                {
                    headers: {
                        "X-Customer-Phone": currentOrderPhone
                    }
                }
            );

            if (String(currentOrderId) !== id) return;

            const status = getPaymentStatus(data);

            if (
                status === "paid" ||
                status === "success" ||
                status === "completed"
            ) {
                stopPaymentPolling();
                await handlePaymentSuccess();
                return;
            }

            if (status === "failed" || status === "cancelled") {
                stopPaymentPolling();

                await handlePaymentFailure(
                    data.failureReason ||
                    data.order?.failureReason ||
                    "Payment failed or was cancelled."
                );

                return;
            }

            showPaymentMessage(
                "Waiting for M-Pesa confirmation. Do not pay again while this order is unresolved."
            );
        } catch (error) {
            console.error("Payment polling error:", error);

            showPaymentMessage(
                "The server could not confirm payment status. " +
                "The order remains saved. Do not make another payment."
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
                "Check your M-Pesa messages and use Check Payment Status. " +
                "This timeout does not mean payment failed."
            );

            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = "Check Payment Status";
            }
        }
    }, intervalMs);
}

// ======================================
// INITIALIZE
// ======================================

displayCart();

loadFoods().catch(() => {
    // The error is already logged and displayed.
});

if (currentOrderId) {
    checkoutStageActive = true;

    if (paymentBox) paymentBox.style.display = "block";
    if (checkoutBtn) checkoutBtn.style.display = "none";

    showPaymentMessage(
        "An existing order was found. Checking its payment status. " +
        "Do not submit another payment."
    );

    if (currentOrderPhone) {
        startPaymentPolling(currentOrderId);
    } else {
        showPaymentMessage(
            "An existing order was found, but its customer phone number " +
            "is missing. Contact the hotel to verify the order before paying again."
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
        console.error("Automatic food refresh failed:", error);
    });
}, 30000);
