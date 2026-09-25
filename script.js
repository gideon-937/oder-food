// ======================================
// API CONFIGURATION
// ======================================

const API_URL = "https://oder-food-2.onrender.com";

console.log("MAIN SCRIPT.JS IS WORKING");


// ======================================
// GET HTML ELEMENTS
// ======================================

const foodContainer =
    document.getElementById("food-container");

const cart =
    document.getElementById("cart");

const cartIcon =
    document.querySelector(".cart-icon");

const closeCart =
    document.getElementById("close-cart");

const cartItems =
    document.getElementById("cart-items");

const cartTotal =
    document.getElementById("cart-total");

const cartCount =
    document.getElementById("cart-count");

const checkoutBtn =
    document.getElementById("checkout-btn");

const payBtn =
    document.getElementById("pay-btn");

const paymentBox =
    document.getElementById("payment-box");

const phoneInput =
    document.getElementById("phone");

const paymentStatus =
    document.getElementById("payment-status");

const paymentStatusText =
    document.getElementById("payment-status-text");

const customerNameInput =
    document.getElementById("customer-name");


// ======================================
// SHOPPING CART
// ======================================

let shoppingCart =
    JSON.parse(
        localStorage.getItem("shoppingCart")
    ) || [];


// ======================================
// SAVE CART
// ======================================

function saveCart() {

    localStorage.setItem(
        "shoppingCart",
        JSON.stringify(shoppingCart)
    );

}


// ======================================
// RESET PAYMENT UI
// ======================================

function resetPaymentUI() {

    // Hide payment box
    paymentBox.style.display =
        "none";


    // Hide payment status
    paymentStatus.style.display =
        "none";


    // Clear payment message
    paymentStatusText.textContent =
        "";


    // Reset Pay Now button
    payBtn.disabled =
        false;

    payBtn.textContent =
        "Pay Now";


    // Restore Checkout button
    if (shoppingCart.length > 0) {

        checkoutBtn.style.display =
            "block";

        checkoutBtn.disabled =
            false;

        checkoutBtn.style.opacity =
            "1";

        checkoutBtn.style.cursor =
            "pointer";

    } else {

        checkoutBtn.style.display =
            "block";

        checkoutBtn.disabled =
            true;

        checkoutBtn.style.opacity =
            "0.5";

        checkoutBtn.style.cursor =
            "not-allowed";

    }

}


// ======================================
// FOOD IMAGE URL
// ======================================

function getFoodImageUrl(image) {

    if (!image) {

        return "";

    }


    image =
        String(image).trim();


    // ======================================
    // COMPLETE URL
    // ======================================

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {

        return image;

    }


    // ======================================
    // WINDOWS PATH -> WEB PATH
    // ======================================

    image =
        image.replace(
            /\\/g,
            "/"
        );


    // ======================================
    // FIND /uploads/
    // ======================================

    if (
        image.includes("/uploads/")
    ) {

        image =
            image.substring(
                image.indexOf(
                    "/uploads/"
                )
            );

    }


    // ======================================
    // ONLY FILENAME
    // ======================================

    if (
        !image.startsWith("/")
    ) {

        image =
            `/uploads/food/${image}`;

    }


    return `${API_URL}${image}`;

}


// ======================================
// LOAD FOOD FROM DATABASE
// ======================================

async function loadFoods() {

    try {

        console.log(
            "Loading food from database..."
        );


        const response =
            await fetch(
                `${API_URL}/api/food`
            );


        console.log(
            "Food API status:",
            response.status
        );


        const data =
            await response.json();


        console.log(
            "FOOD DATA:",
            data
        );


        if (!response.ok) {

            foodContainer.innerHTML = `
                <p>
                    ${
                        data.message ||
                        "Could not load food."
                    }
                </p>
            `;

            return;

        }


        const foods =
            Array.isArray(data)
                ? data
                : data.foods || [];


        console.log(
            "FOODS:",
            foods
        );


        displayFoods(
            foods
        );


    } catch (error) {

        console.error(
            "Food loading error:",
            error
        );


        foodContainer.innerHTML = `
            <p>
                Could not connect to food server.
            </p>
        `;

    }

}


// ======================================
// DISPLAY FOOD
// ======================================

function displayFoods(foods) {

    if (
        !foods ||
        foods.length === 0
    ) {

        foodContainer.innerHTML = `
            <p>
                No food available at the moment.
            </p>
        `;

        return;

    }


    foodContainer.innerHTML =
        "";


    foods.forEach(
        food => {

            const imageUrl =
                getFoodImageUrl(
                    food.image
                );


            console.log(
                "--------------------------------"
            );


            console.log(
                "FOOD:",
                food.name
            );


            console.log(
                "FOOD ID:",
                food._id
            );


            console.log(
                "DATABASE IMAGE:",
                food.image
            );


            console.log(
                "FINAL IMAGE URL:",
                imageUrl
            );


            const available =
                food.available !== false;


            const foodCard =
                document.createElement(
                    "div"
                );


            foodCard.className =
                "hero";


            foodCard.innerHTML = `

                ${
                    imageUrl
                        ? `
                            <img
                                src="${imageUrl}"
                                alt="${food.name}"
                                class="food-image"
                                onerror="
                                    console.error(
                                        'IMAGE FAILED:',
                                        this.src
                                    );
                                "
                            >
                        `
                        : `
                            <div class="no-image">
                                No Image
                            </div>
                        `
                }


                <h1 class="price">
                    KSh ${Number(
                        food.price
                    ).toLocaleString()}
                </h1>


                <p>
                    ${food.name}
                </p>


                <p>
                    ${food.description || ""}
                </p>


                ${
                    food.category
                        ? `
                            <p>
                                Category:
                                ${food.category}
                            </p>
                        `
                        : ""
                }


                ${
                    available
                        ? `
                            <button
                                class="add-cart-btn"
                                data-id="${food._id}"
                                data-name="${food.name}"
                                data-price="${food.price}"
                                data-image="${food.image || ""}"
                            >
                                🛒 Add to Cart
                            </button>
                        `
                        : `
                            <button
                                class="add-cart-btn"
                                disabled
                            >
                                ❌ Unavailable
                            </button>
                        `
                }

            `;


            foodContainer.appendChild(
                foodCard
            );

        }
    );


    // ======================================
    // ADD TO CART
    // ======================================

    const buttons =
        foodContainer.querySelectorAll(
            ".add-cart-btn:not(:disabled)"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    // ======================================
                    // GET FOOD INFORMATION
                    // ======================================

                    const foodId =
                        button.dataset.id;


                    const name =
                        button.dataset.name;


                    const price =
                        Number(
                            button.dataset.price
                        );


                    const image =
                        button.dataset.image;


                    // ======================================
                    // CHECK FOOD ID
                    // ======================================

                    if (!foodId) {

                        console.error(
                            "Food ID is missing."
                        );


                        alert(
                            "Unable to add this food to the basket. Please refresh the page."
                        );


                        return;

                    }


                    // ======================================
                    // CHECK EXISTING ITEM
                    // ======================================

                    const existing =
                        shoppingCart.find(
                            item =>
                                item.foodId ===
                                foodId
                        );


                    if (existing) {

                        existing.quantity++;

                    } else {

                        shoppingCart.push({

                            foodId:
                                foodId,

                            name:
                                name,

                            price:
                                price,

                            image:
                                image,

                            quantity:
                                1

                        });

                    }


                    saveCart();


                    displayCart();


                    // Open cart
                    cart.classList.add(
                        "active"
                    );

                }
            );

        }
    );

}


// ======================================
// DISPLAY SHOPPING CART
// ======================================

function displayCart() {

    cartItems.innerHTML =
        "";


    // ======================================
    // EMPTY CART
    // ======================================

    if (
        shoppingCart.length === 0
    ) {

        cartItems.innerHTML = `
            <p>
                Your basket is empty.
            </p>
        `;


        cartTotal.textContent =
            "0";


        cartCount.textContent =
            "0";


        // Show Checkout button
        checkoutBtn.style.display =
            "block";


        // Disable Checkout
        checkoutBtn.disabled =
            true;


        checkoutBtn.style.opacity =
            "0.5";


        checkoutBtn.style.cursor =
            "not-allowed";


        // Hide payment box
        paymentBox.style.display =
            "none";


        // Hide payment status
        paymentStatus.style.display =
            "none";


        return;

    }


    // ======================================
    // CART HAS ITEMS
    // ======================================

    // IMPORTANT:
    // Always restore Checkout button
    // whenever the cart has items.

    checkoutBtn.style.display =
        "block";


    checkoutBtn.disabled =
        false;


    checkoutBtn.style.opacity =
        "1";


    checkoutBtn.style.cursor =
        "pointer";


    let total =
        0;


    let count =
        0;


    shoppingCart.forEach(
        (item, index) => {

            const itemTotal =
                Number(item.price) *
                Number(item.quantity);


            total +=
                itemTotal;


            count +=
                Number(item.quantity);


            const imageUrl =
                getFoodImageUrl(
                    item.image
                );


            const cartItem =
                document.createElement(
                    "div"
                );


            cartItem.className =
                "cart-item";


            cartItem.innerHTML = `

                ${
                    imageUrl
                        ? `
                            <img
                                src="${imageUrl}"
                                alt="${item.name}"
                                class="cart-food-image"
                            >
                        `
                        : ""
                }


                <div class="cart-item-details">

                    <h4>
                        ${item.name}
                    </h4>


                    <p>
                        KSh
                        ${Number(
                            item.price
                        ).toLocaleString()}
                    </p>


                    <div
                        class="quantity-controls"
                    >

                        <button
                            class="decrease-btn"
                            data-index="${index}"
                        >
                            -
                        </button>


                        <span>
                            ${item.quantity}
                        </span>


                        <button
                            class="increase-btn"
                            data-index="${index}"
                        >
                            +
                        </button>

                    </div>


                    <p>
                        Subtotal:
                        KSh
                        ${itemTotal.toLocaleString()}
                    </p>


                    <button
                        class="remove-btn"
                        data-index="${index}"
                    >
                        Remove
                    </button>

                </div>

            `;


            cartItems.appendChild(
                cartItem
            );

        }
    );


    // ======================================
    // UPDATE TOTAL
    // ======================================

    cartTotal.textContent =
        total.toLocaleString();


    cartCount.textContent =
        count;


    // ======================================
    // INCREASE
    // ======================================

    document
        .querySelectorAll(
            ".increase-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.index
                            );


                        shoppingCart[
                            index
                        ].quantity++;


                        saveCart();


                        displayCart();

                    }
                );

            }
        );


    // ======================================
    // DECREASE
    // ======================================

    document
        .querySelectorAll(
            ".decrease-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.index
                            );


                        if (
                            shoppingCart[
                                index
                            ].quantity > 1
                        ) {

                            shoppingCart[
                                index
                            ].quantity--;

                        } else {

                            shoppingCart.splice(
                                index,
                                1
                            );

                        }


                        saveCart();


                        displayCart();

                    }
                );

            }
        );


    // ======================================
    // REMOVE
    // ======================================

    document
        .querySelectorAll(
            ".remove-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.index
                            );


                        shoppingCart.splice(
                            index,
                            1
                        );


                        saveCart();


                        displayCart();

                    }
                );

            }
        );

}


// ======================================
// OPEN CART
// ======================================

cartIcon.addEventListener(
    "click",
    () => {

        cart.classList.add(
            "active"
        );

    }
);


// ======================================
// CLOSE CART
// ======================================

closeCart.addEventListener(
    "click",
    () => {

        // Close cart
        cart.classList.remove(
            "active"
        );


        // IMPORTANT:
        // Return payment area to original state
        resetPaymentUI();

    }
);


// ======================================
// CHECKOUT
// ======================================

checkoutBtn.addEventListener(
    "click",
    () => {

        if (
            shoppingCart.length === 0
        ) {

            alert(
                "Your shopping basket is empty."
            );


            return;

        }


        // Hide Checkout button
        checkoutBtn.style.display =
            "none";


        // Show payment box
        paymentBox.style.display =
            "block";


        // Hide previous payment status
        paymentStatus.style.display =
            "none";


        paymentStatusText.textContent =
            "";


        // Put cursor in customer name
        customerNameInput.focus();

    }
);


// ======================================
// MPESA PAYMENT
// ======================================

payBtn.addEventListener(
    "click",
    async () => {

        const customerName =
            customerNameInput.value.trim();


        console.log(
            "CUSTOMER NAME FROM INPUT:",
            customerName
        );


        const phone =
            phoneInput.value.trim();


        console.log(
            "PHONE FROM INPUT:",
            phone
        );


        // ======================================
        // CUSTOMER NAME REQUIRED
        // ======================================

        if (!customerName) {

            alert(
                "Please enter your name before making payment."
            );


            customerNameInput.focus();


            return;

        }


        // ======================================
        // PHONE VALIDATION
        // ======================================

        if (!phone) {

            alert(
                "Please enter your M-Pesa phone number."
            );


            phoneInput.focus();


            return;

        }


        if (
            !/^07\d{8}$/.test(phone)
        ) {

            alert(
                "Enter a valid M-Pesa number starting with 07, e.g. 0712345678"
            );


            phoneInput.focus();


            return;

        }


        // ======================================
        // CONVERT PHONE
        // ======================================

        const mpesaPhone =
            "254" +
            phone.substring(1);


        // ======================================
        // CHECK CART
        // ======================================

        if (
            shoppingCart.length === 0
        ) {

            alert(
                "Your shopping basket is empty."
            );


            return;

        }


        // ======================================
        // CALCULATE TOTAL
        // ======================================

        const totalPrice =
            shoppingCart.reduce(
                (
                    total,
                    item
                ) => {

                    return (
                        total +
                        Number(item.price) *
                        Number(item.quantity)
                    );

                },
                0
            );


        try {

            // ======================================
            // DISABLE PAY BUTTON
            // ======================================

            payBtn.disabled =
                true;


            payBtn.textContent =
                "Processing...";


            paymentStatus.style.display =
                "block";


            paymentStatusText.textContent =
                "Creating your order...";


            // ======================================
            // CREATE ORDER
            // ======================================

            const orderResponse =
                await fetch(
                    `${API_URL}/api/orders`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                customer: {

                                    name:
                                        customerName,

                                    phone:
                                        mpesaPhone

                                },

                                items:
                                    shoppingCart.map(
                                        item => ({

                                            foodId:
                                                item.foodId,

                                            name:
                                                item.name,

                                            price:
                                                Number(
                                                    item.price
                                                ),

                                            quantity:
                                                Number(
                                                    item.quantity
                                                ),

                                            image:
                                                item.image

                                        })
                                    ),

                                totalPrice:
                                    totalPrice

                            })

                    }
                );


            const orderData =
                await orderResponse.json();


            console.log(
                "ORDER CREATED:",
                orderData
            );


            if (
                !orderResponse.ok
            ) {

                throw new Error(
                    orderData.message ||
                    "Failed to create order."
                );

            }


            const orderId =
                orderData._id ||
                orderData.order?._id;


            if (!orderId) {

                throw new Error(
                    "Order ID was not returned by server."
                );

            }


            console.log(
                "ORDER ID:",
                orderId
            );


            // ======================================
            // INITIATE MPESA STK PUSH
            // ======================================

            paymentStatusText.textContent =
                "Sending payment request to your phone...";


            const paymentResponse =
                await fetch(
                    `${API_URL}/api/mpesa/stkpush`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                phone:
                                    mpesaPhone,

                                amount:
                                    totalPrice,

                                orderId:
                                    orderId

                            })

                    }
                );


            const paymentData =
                await paymentResponse.json();


            console.log(
                "PAYMENT INITIATED:",
                paymentData
            );


            if (
                !paymentResponse.ok
            ) {

                throw new Error(
                    paymentData.message ||
                    "Failed to initiate payment."
                );

            }


            // ======================================
            // PAYMENT REQUEST SENT
            // ======================================

            paymentStatusText.textContent =
                "Please check your phone and enter your M-Pesa PIN.";


            // ======================================
            // START PAYMENT POLLING
            // ======================================

            checkPaymentStatus(
                orderId
            );

        }


        catch (error) {

            console.error(
                "PAYMENT ERROR:",
                error
            );


            paymentStatus.style.display =
                "block";


            paymentStatusText.textContent =
                error.message ||
                "Payment failed. Please try again.";


            // Allow Pay Now again
            payBtn.disabled =
                false;


            payBtn.textContent =
                "Pay Now";

        }

    }
);


// ======================================
// CHECK PAYMENT STATUS
// ======================================

async function checkPaymentStatus(
    orderId
) {

    let attempts =
        0;


    // ======================================
    // MAXIMUM 3 MINUTES
    // ======================================

    const maxAttempts =
        60;


    // ======================================
    // EVERY 3 SECONDS
    // ======================================

    const intervalMs =
        3000;


    console.log(
        "STARTING PAYMENT POLLING"
    );


    console.log(
        "ORDER ID:",
        orderId
    );


    const interval =
        setInterval(
            async () => {

                attempts++;


                console.log(
                    `Checking payment status... Attempt ${attempts}/${maxAttempts}`
                );


                try {

                    // ======================================
                    // GET PAYMENT STATUS
                    // ======================================

                    const response =
                        await fetch(
                            `${API_URL}/api/orders/payment-status/${orderId}`
                        );


                    console.log(
                        "PAYMENT STATUS HTTP:",
                        response.status
                    );


                    if (
                        !response.ok
                    ) {

                        console.error(
                            "Payment status request failed:",
                            response.status
                        );


                        return;

                    }


                    const data =
                        await response.json();


                    console.log(
                        "PAYMENT STATUS RESPONSE:",
                        data
                    );


                    // ======================================
                    // GET STATUS
                    // ======================================

                    const status =
                        data.paymentStatus ||
                        data.status ||
                        data.order?.paymentStatus ||
                        data.order?.status ||
                        "";


                    console.log(
                        "ACTUAL PAYMENT STATUS:",
                        status
                    );


                    // ======================================
                    // PAID
                    // ======================================

                    if (
                        status === "Paid" ||
                        status === "paid" ||
                        status === "PAID"
                    ) {

                        clearInterval(
                            interval
                        );


                        console.log(
                            "================================"
                        );


                        console.log(
                            "PAYMENT CONFIRMED!"
                        );


                        console.log(
                            "ORDER ID:",
                            orderId
                        );


                        console.log(
                            "================================"
                        );


                        // ======================================
                        // CLEAR SHOPPING CART
                        // ======================================

                        shoppingCart =
                            [];


                        localStorage.removeItem(
                            "shoppingCart"
                        );


                        console.log(
                            "SHOPPING CART CLEARED"
                        );


                        // ======================================
                        // RESTORE ORIGINAL CART DESIGN
                        // ======================================

                        displayCart();


                        // ======================================
                        // CLOSE CART
                        // ======================================

                        cart.classList.remove(
                            "active"
                        );


                        // ======================================
                        // HIDE PAYMENT BOX
                        // ======================================

                        paymentBox.style.display =
                            "none";


                        paymentStatus.style.display =
                            "none";


                        // ======================================
                        // RESTORE CHECKOUT BUTTON
                        // ======================================

                        checkoutBtn.style.display =
                            "block";


                        checkoutBtn.disabled =
                            true;


                        checkoutBtn.style.opacity =
                            "0.5";


                        checkoutBtn.style.cursor =
                            "not-allowed";


                        // ======================================
                        // RESET PAY BUTTON
                        // ======================================

                        payBtn.disabled =
                            false;


                        payBtn.textContent =
                            "Pay Now";


                        // ======================================
                        // CLEAR CUSTOMER INPUTS
                        // ======================================

                        phoneInput.value =
                            "";


                        customerNameInput.value =
                            "";


                        // ======================================
                        // VERIFY CART
                        // ======================================

                        console.log(
                            "FINAL CART:",
                            shoppingCart
                        );


                        console.log(
                            "LOCAL STORAGE CART:",
                            localStorage.getItem(
                                "shoppingCart"
                            )
                        );


                        // ======================================
                        // SUCCESS MESSAGE
                        // ======================================

                        alert(
                            "Payment successful! Your order has been received."
                        );


                        return;

                    }


                    // ======================================
                    // FAILED / CANCELLED
                    // ======================================

                    if (
                        status === "Failed" ||
                        status === "failed" ||
                        status === "Cancelled" ||
                        status === "cancelled"
                    ) {

                        clearInterval(
                            interval
                        );


                        paymentStatus.style.display =
                            "block";


                        paymentStatusText.textContent =
                            "Payment was not completed. You can try again.";


                        // Allow retry
                        payBtn.disabled =
                            false;


                        payBtn.textContent =
                            "Pay Now";


                        console.log(
                            "PAYMENT FAILED"
                        );


                        return;

                    }


                    // ======================================
                    // TIMEOUT
                    // ======================================

                    if (
                        attempts >= maxAttempts
                    ) {

                        clearInterval(
                            interval
                        );


                        paymentStatus.style.display =
                            "block";


                        paymentStatusText.textContent =
                            "Payment confirmation timed out. Please check your M-Pesa messages or try again.";


                        payBtn.disabled =
                            false;


                        payBtn.textContent =
                            "Pay Now";


                        console.log(
                            "PAYMENT POLLING TIMED OUT"
                        );


                        return;

                    }


                    // ======================================
                    // PENDING
                    // ======================================

                    paymentStatus.style.display =
                        "block";


                    paymentStatusText.textContent =
                        "Waiting for M-Pesa payment confirmation...";

                }


                catch (error) {

                    console.error(
                        "Payment status error:",
                        error
                    );

                }

            },
            intervalMs
        );

}


// ======================================
// INITIALIZE
// ======================================

displayCart();

loadFoods();