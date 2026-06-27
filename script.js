// Get HTML elements
const cart = document.getElementById("cart");
const cartIcon = document.querySelector(".cart-icon");
const closeCart = document.getElementById("close-cart");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");
const addCartButtons = document.querySelectorAll(".add-cart-btn");

// Load cart from localStorage
let shoppingCart = JSON.parse(localStorage.getItem("shoppingCart")) || [];

// Open cart
cartIcon.addEventListener("click", () => {
    cart.classList.add("active");
});

// Close cart
closeCart.addEventListener("click", () => {
    cart.classList.remove("active");
});

// Add product
addCartButtons.forEach(button => {

    button.addEventListener("click", () => {

        const name = button.dataset.name;
        const price = Number(button.dataset.price);
        const image = button.dataset.image;

        // Check if already exists
        const existing = shoppingCart.find(item => item.name === name);

        if (existing) {
            existing.quantity++;
        } else {
            shoppingCart.push({
                name,
                price,
                image,
                quantity: 1
            });
        }

        saveCart();
        displayCart();

        // Open cart automatically
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

            <img src="${item.image}" alt="${item.name}">

            <div class="item-details">

                <h4>${item.name}</h4>

                <p>Ksh ${item.price}</p>

                <div class="quantity">

                    <button onclick="decreaseQuantity(${index})">-</button>

                    <span>${item.quantity}</span>

                    <button onclick="increaseQuantity(${index})">+</button>

                </div>

            </div>

            <button class="remove-btn"
            onclick="removeItem(${index})">
            🗑
            </button>

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

// Remove completely
function removeItem(index) {

    shoppingCart.splice(index, 1);

    saveCart();
    displayCart();

}

// Save cart
function saveCart() {

    localStorage.setItem("shoppingCart", JSON.stringify(shoppingCart));

}

// Checkout
document.getElementById("checkout-btn").addEventListener("click", () => {

    if (shoppingCart.length === 0) {

        alert("Your cart is empty!");

        return;

    }

    alert("Thank you for your order!");

    shoppingCart = [];

    saveCart();

    displayCart();

});

// Show cart on page load
displayCart();