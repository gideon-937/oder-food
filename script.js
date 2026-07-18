// Get HTML elements
const cart = document.getElementById("cart");
const cartIcon = document.querySelector(".cart-icon");
const closeCart = document.getElementById("close-cart");

const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");

const addCartButtons = document.querySelectorAll(".add-cart-btn");

const checkoutBtn = document.getElementById("checkout-btn");
const payBtn = document.getElementById("pay-btn");

const paymentBox = document.getElementById("payment-box");
const phoneInput = document.getElementById("phone");

const paymentStatus = document.getElementById("payment-status");
const paymentStatusText = document.getElementById("payment-status-text");


// Load cart
let shoppingCart = JSON.parse(localStorage.getItem("shoppingCart")) || [];


// Open cart
cartIcon.addEventListener("click", () => {
    cart.classList.add("active");
});


// Close cart
closeCart.addEventListener("click", () => {
    cart.classList.remove("active");
});


// Add products to cart
addCartButtons.forEach(button => {
    button.addEventListener("click", () => {
        const name = button.dataset.name;
        const price = Number(button.dataset.price);
        const image = button.dataset.image;

        const existing = shoppingCart.find(item => item.name === name);

        if (existing) {
            existing.quantity++;
        } else {
            shoppingCart.push({ name, price, image, quantity: 1 });
        }

        saveCart();
        displayCart();
        cart.classList.add("active");
    });
});


// Display cart
function displayCart() {
    cartItems.innerHTML = "";
    let total = 0;
    let count = 0;

    shoppingCart.forEach((item, index) => {
        total += item.price * item.quantity;
        count += item.quantity;

        cartItems.innerHTML += `
        <div class="cart-item">
            <img src="${item.image}">
            <div class="item-details">
                <h4>${item.name}</h4>
                <p>Ksh ${item.price}</p>
                <div class="quantity">
                    <button onclick="decreaseQuantity(${index})">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="increaseQuantity(${index})">+</button>
                </div>
            </div>
            <button class="remove-btn" onclick="removeItem(${index})">🗑</button>
        </div>
        `;
    });

    cartTotal.textContent = total;
    cartCount.textContent = count;
}


// Increase quantity
function increaseQuantity(index) {
    shoppingCart[index].quantity++;
    saveCart();
    displayCart();
}


// Decrease quantity
function decreaseQuantity(index) {
    if (shoppingCart[index].quantity > 1) {
        shoppingCart[index].quantity--;
    } else {
        shoppingCart.splice(index, 1);
    }
    saveCart();
    displayCart();
}


// Remove item
function removeItem(index) {
    shoppingCart.splice(index, 1);
    saveCart();
    displayCart();
}


// Save cart
function saveCart() {
    localStorage.setItem("shoppingCart", JSON.stringify(shoppingCart));
}


// ======================================
// FIRST CHECKOUT BUTTON - SHOW MPESA INPUT
// ======================================
checkoutBtn.addEventListener("click", () => {
    if (shoppingCart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    paymentBox.style.display = "block";
    checkoutBtn.style.display = "none";
});


// ======================================
// PAY WITH MPESA BUTTON
// ======================================
payBtn.addEventListener("click", async () => {

    const phone = phoneInput.value.trim();

    if (!phone) {
        alert("Please enter your M-Pesa phone number.");
        return;
    }

    const items = shoppingCart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
    }));

    const totalPrice = shoppingCart.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    );

    try {

        // STEP 1: CREATE ORDER
        const orderResponse = await fetch("http://localhost:5000/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer: { phone },
                items,
                totalPrice
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            alert(orderData.message || "Sorry, we couldn't place your order. Please try again.");
            return;
        }

        console.log("ORDER CREATED:", orderData);

        // STEP 2: TRIGGER PAYMENT
        const paymentResponse = await fetch("http://localhost:5000/api/mpesa/stkpush", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId: orderData.order._id,
                phone
            })
        });

        const paymentData = await paymentResponse.json();

        if (!paymentResponse.ok) {
            alert(paymentData.message || "We couldn't start the payment. Please try again.");
            return;
        }

        console.log("PAYMENT INITIATED:", paymentData);

        // Hide the phone input, show the "waiting" screen
        paymentBox.style.display = "none";
        paymentStatus.style.display = "block";
        paymentStatusText.textContent = "Please check your phone and enter your M-Pesa PIN to complete payment...";

        // STEP 3: POLL FOR PAYMENT CONFIRMATION
        pollPaymentStatus(orderData.order._id);

    } catch (error) {
        console.error(error);
        alert("We couldn't connect to the server. Please check your internet and try again.");
    }

});


// ======================================
// POLL BACKEND UNTIL PAYMENT IS CONFIRMED
// ======================================
function pollPaymentStatus(orderId) {

    let attempts = 0;
    const maxAttempts = 20;       // 20 tries
    const intervalMs = 3000;      // every 3 seconds → ~60 seconds total

    const interval = setInterval(async () => {

        attempts++;

        try {

            const response = await fetch(`http://localhost:5000/api/orders/${orderId}`);
            const data = await response.json();

            if (!response.ok) {
                console.error("Error checking order status:", data.message);
                return;
            }

            const status = data.order.paymentStatus;

            if (status === "Paid") {

                clearInterval(interval);

                paymentStatusText.textContent = "✅ Payment received! Your order is being prepared.";

                shoppingCart = [];
                saveCart();
                displayCart();

                setTimeout(() => {
                    cart.classList.remove("active");
                    paymentStatus.style.display = "none";
                    checkoutBtn.style.display = "block";
                    phoneInput.value = "";
                }, 4000);

            } else if (status === "Failed") {

                clearInterval(interval);
                paymentStatusText.textContent = "❌ Payment failed. Please try again.";

                setTimeout(() => {
                    paymentStatus.style.display = "none";
                    paymentBox.style.display = "block";
                }, 3000);

            } else if (attempts >= maxAttempts) {

                clearInterval(interval);
                paymentStatusText.textContent = "We haven't received your payment yet. Please check your phone or try again.";

                setTimeout(() => {
                    paymentStatus.style.display = "none";
                    paymentBox.style.display = "block";
                }, 3000);
            }

        } catch (error) {
            console.error("Polling error:", error);
        }

    }, intervalMs);
}


// Load cart on page start
displayCart();