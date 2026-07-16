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
        alert("Enter M-Pesa phone number");
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

        // CREATE ORDER - this already triggers the STK push on the backend
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
            alert(orderData.message || "Order failed");
            return;
        }

        console.log("ORDER:", orderData);

        // Order created + STK push already sent by the backend.
        alert("STK Push sent. Check your phone.");

        shoppingCart = [];
        saveCart();
        displayCart();

        cart.classList.remove("active");
        paymentBox.style.display = "none";
        checkoutBtn.style.display = "block";
        phoneInput.value = "";

    } catch (error) {
        console.error(error);
        alert("Server connection error");
    }

});


// Load cart on page start
displayCart();