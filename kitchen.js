
// ======================================================
// KITCHEN AUTHENTICATION
// ======================================================

let kitchenToken = localStorage.getItem("kitchenToken");

if (!kitchenToken) {
    window.location.href =
        "https://oder-food-3.onrender.com/kitchen-login.html";
}


// ======================================================
// API URL
// ======================================================

const API_URL = "http://localhost:5000";


// ======================================================
// ORDERS ELEMENTS
// ======================================================

const ordersContainer =
    document.getElementById("orders-container");

const refreshBtn =
    document.getElementById("refresh-btn");

const printBtn =
    document.getElementById("print-btn");

const totalOrders =
    document.getElementById("total-orders");

const paidOrdersCount =
    document.getElementById("paid-orders");

const processingOrders =
    document.getElementById("processing-orders");

const readyOrders =
    document.getElementById("ready-orders");

const filterButtons =
    document.querySelectorAll(".filter-btn");


// ======================================================
// ORDER VARIABLES
// ======================================================

let allOrders = [];
let knownOrderIds = new Set();
let isFirstLoad = true;


// ======================================================
// NOTIFICATION SOUND
// ======================================================

const alertSound = new Audio(
    "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICAgICAgICA"
);


// ======================================================
// LOAD ORDERS
// ======================================================

async function loadOrders() {

    try {

        const response = await fetch(
            `${API_URL}/api/orders`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${kitchenToken}`
                }
            }
        );


        const data = await response.json();


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem("kitchenToken");

            window.location.href =
                "https://oder-food-3.onrender.com/kitchen-login.html";

            return;
        }


        if (!response.ok) {

            ordersContainer.innerHTML =
                `<p>${data.message || "Could not load orders."}</p>`;

            return;
        }


        allOrders =
            data.orders || data;


        const paidOrders =
            allOrders.filter(
                order =>
                    order.paymentStatus === "Paid"
            );


        updateDashboard(paidOrders);

        detectNewOrders(paidOrders);

        displayOrders(paidOrders);


    } catch (error) {

        console.error(
            "Order loading error:",
            error
        );

        ordersContainer.innerHTML =
            "<p>Could not connect to server.</p>";
    }
}


// ======================================================
// UPDATE DASHBOARD NUMBERS
// ======================================================

function updateDashboard(orders) {

    totalOrders.innerText =
        orders.length;


    paidOrdersCount.innerText =
        orders.filter(
            order =>
                order.paymentStatus === "Paid"
        ).length;


    processingOrders.innerText =
        orders.filter(
            order =>
                order.orderStatus === "Processing"
        ).length;


    readyOrders.innerText =
        orders.filter(
            order =>
                order.orderStatus === "Ready"
        ).length;
}


// ======================================================
// DETECT NEW PAID ORDERS
// ======================================================

function detectNewOrders(orders) {

    const newOrders =
        orders.filter(
            order =>
                !knownOrderIds.has(order._id)
        );


    if (
        !isFirstLoad &&
        newOrders.length > 0
    ) {

        alertSound.play().catch(() => {});
    }


    knownOrderIds =
        new Set(
            orders.map(
                order => order._id
            )
        );


    isFirstLoad = false;
}


// ======================================================
// DISPLAY ORDERS
// ======================================================

function displayOrders(orders) {

    if (orders.length === 0) {

        ordersContainer.innerHTML =
            "<p>No paid orders yet.</p>";

        return;
    }


    ordersContainer.innerHTML = "";


    orders.forEach(order => {

        const itemsList =
            (order.items || [])
                .map(
                    item =>
                        `<li>
                            ${item.quantity} × ${item.name}
                        </li>`
                )
                .join("");


        const orderTime =
            new Date(
                order.createdAt
            ).toLocaleString();


        const card =
            document.createElement("div");


        card.className =
            "order-card";


        card.innerHTML = `

            <h3>
                Order #${order._id
                    .slice(-6)
                    .toUpperCase()}
            </h3>

            <p class="order-time">
                ${orderTime}
            </p>

            <p>
               <strong>Customer:</strong>
                   ${order.customer?.name || "Unknown"}
                     </p>

                       <p>
                                <strong>Phone:</strong>
                           ${order.customer?.phone || "Unknown"}
                                 </p>

            <h4>Items</h4>

            <ul class="order-items">
                ${itemsList}
            </ul>

            <p>
                <strong>Total:</strong>
                KSh ${order.totalPrice}
            </p>

            <p>
                <strong>Payment:</strong>
                ${order.paymentStatus}
            </p>

            <p>
                <strong>Status:</strong>
                ${order.orderStatus}
            </p>

            <select
                class="order-status-select"
                data-id="${order._id}"
            >

                <option
                    value="Pending"
                    ${order.orderStatus === "Pending"
                        ? "selected"
                        : ""}
                >
                    Pending
                </option>

                <option
                    value="Processing"
                    ${order.orderStatus === "Processing"
                        ? "selected"
                        : ""}
                >
                    Processing
                </option>

                <option
                    value="Ready"
                    ${order.orderStatus === "Ready"
                        ? "selected"
                        : ""}
                >
                    Ready
                </option>

                <option
                    value="Delivered"
                    ${order.orderStatus === "Delivered"
                        ? "selected"
                        : ""}
                >
                    Delivered
                </option>

            </select>
        `;


        ordersContainer.appendChild(card);
    });


    document
        .querySelectorAll(".order-status-select")
        .forEach(select => {

            select.addEventListener(
                "change",
                event => {

                    updateOrderStatus(
                        event.target.dataset.id,
                        event.target.value
                    );

                }
            );

        });
}


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

async function updateOrderStatus(
    id,
    status
) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/orders/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${kitchenToken}`
                    },

                    body: JSON.stringify({
                        orderStatus: status
                    })
                }
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "kitchenToken"
            );

            window.location.href =
                "https://oder-food-3.onrender.com/kitchen-login.html";

            return;
        }


        if (!response.ok) {

            const data =
                await response.json();

            alert(
                data.message ||
                "Could not update order status."
            );

            return;
        }


        loadOrders();


    } catch (error) {

        console.error(
            "Order status error:",
            error
        );

    }
}


// ======================================================
// ORDER FILTER BUTTONS
// ======================================================

filterButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            filterButtons.forEach(btn =>
                btn.classList.remove("active")
            );


            button.classList.add("active");


            const filter =
                button.dataset.filter;


            const paidOrders =
                allOrders.filter(
                    order =>
                        order.paymentStatus === "Paid"
                );


            if (filter === "all") {

                displayOrders(
                    paidOrders
                );

            } else {

                displayOrders(
                    paidOrders.filter(
                        order =>
                            order.orderStatus === filter
                    )
                );

            }

        }
    );

});


// ======================================================
// REFRESH / PRINT
// ======================================================

refreshBtn.addEventListener(
    "click",
    loadOrders
);


printBtn.addEventListener(
    "click",
    () => window.print()
);


// ======================================================
// FOOD MANAGEMENT ELEMENTS
// ======================================================

const showFoodFormBtn =
    document.getElementById(
        "show-food-form-btn"
    );

const foodFormContainer =
    document.getElementById(
        "food-form-container"
    );

const foodForm =
    document.getElementById(
        "food-form"
    );

const cancelFoodBtn =
    document.getElementById(
        "cancel-food-btn"
    );

const foodContainer =
    document.getElementById(
        "food-container"
    );


// ======================================================
// EDITING FOOD
// ======================================================

let editingFoodId = null;


// ======================================================
// SHOW FOOD FORM
// ======================================================

showFoodFormBtn.addEventListener(
    "click",
    () => {

        editingFoodId = null;

        foodForm.reset();


        document.getElementById(
            "food-available"
        ).checked = true;


        document.getElementById(
            "food-form-title"
        ).innerText =
            "Add New Food";


        document.getElementById(
            "save-food-btn"
        ).innerText =
            "💾 Save Food";


        foodFormContainer.style.display =
            "block";


        document.getElementById(
            "food-name"
        ).focus();

    }
);


// ======================================================
// CANCEL FOOD FORM
// ======================================================

cancelFoodBtn.addEventListener(
    "click",
    () => {

        editingFoodId = null;

        foodForm.reset();


        document.getElementById(
            "food-available"
        ).checked = true;


        document.getElementById(
            "food-form-title"
        ).innerText =
            "Add New Food";


        document.getElementById(
            "save-food-btn"
        ).innerText =
            "💾 Save Food";


        foodFormContainer.style.display =
            "none";

    }
);


// ======================================================
// LOAD FOODS
// ======================================================

async function loadFoods() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/food`
            );


        const data =
            await response.json();


        if (!response.ok) {

            foodContainer.innerHTML =
                `<p>${data.message || "Could not load food."}</p>`;

            return;
        }


        const foods =
            Array.isArray(data)
                ? data
                : data.foods || [];


        displayFoods(foods);


    } catch (error) {

        console.error(
            "Food loading error:",
            error
        );


        foodContainer.innerHTML =
            "<p>Could not connect to server.</p>";
    }
}


// ======================================================
// FOOD IMAGE URL
// ======================================================

function getFoodImageUrl(image) {

    if (!image) {
        return "";
    }


    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {
        return image;
    }


    return `${API_URL}${image}`;
}


// ======================================================
// DISPLAY FOODS
// ======================================================

function displayFoods(foods) {

    if (foods.length === 0) {

        foodContainer.innerHTML =
            "<p>No food has been added yet.</p>";

        return;
    }


    foodContainer.innerHTML = "";


    foods.forEach(food => {

        const foodCard =
            document.createElement("div");


        foodCard.className =
            "food-card";


        const availabilityText =
            food.available
                ? "Available"
                : "Unavailable";


        const availabilityClass =
            food.available
                ? "available"
                : "unavailable";


        const imageUrl =
            getFoodImageUrl(food.image);


        foodCard.innerHTML = `

            ${
                imageUrl
                    ? `
                    <img
                        src="${imageUrl}"
                        alt="${food.name}"
                        class="food-image"
                    >
                    `
                    : `
                    <div class="food-image no-image">
                        No Image
                    </div>
                    `
            }


            <div class="food-details">

                <h3>
                    ${food.name}
                </h3>


                <p>
                    ${food.description}
                </p>


                <p>
                    <strong>
                        KSh ${food.price}
                    </strong>
                </p>


                <p>
                    Category:
                    ${food.category || "Other"}
                </p>


                <span
                    class="food-status ${availabilityClass}"
                >
                    ${availabilityText}
                </span>

            </div>


            <div class="food-actions">

                <button
                    class="edit-food-btn"
                    data-id="${food._id}"
                >
                    ✏️ Edit
                </button>


                <button
                    class="toggle-food-btn"
                    data-id="${food._id}"
                    data-available="${food.available}"
                >

                    ${
                        food.available
                            ? "❌ Make Unavailable"
                            : "✅ Make Available"
                    }

                </button>


                <button
                    class="delete-food-btn"
                    data-id="${food._id}"
                >
                    🗑️ Delete
                </button>

            </div>

        `;


        foodContainer.appendChild(
            foodCard
        );

    });


    // ==================================================
    // EDIT BUTTONS
    // ==================================================

    document
        .querySelectorAll(".edit-food-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    editFood(
                        button.dataset.id
                    );

                }
            );

        });


    // ==================================================
    // AVAILABILITY BUTTONS
    // ==================================================

    document
        .querySelectorAll(".toggle-food-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    toggleFoodAvailability(
                        button.dataset.id,
                        button.dataset.available === "true"
                    );

                }
            );

        });


    // ==================================================
    // DELETE BUTTONS
    // ==================================================

    document
        .querySelectorAll(".delete-food-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteFood(
                        button.dataset.id
                    );

                }
            );

        });

}


// ======================================================
// ADD / UPDATE FOOD
// ======================================================

foodForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const name =
            document.getElementById(
                "food-name"
            ).value.trim();


        const description =
            document.getElementById(
                "food-description"
            ).value.trim();


        const price =
            Number(
                document.getElementById(
                    "food-price"
                ).value
            );


        const category =
            document.getElementById(
                "food-category"
            ).value;


        const available =
            document.getElementById(
                "food-available"
            ).checked;


        const imageInput =
            document.getElementById(
                "food-image"
            );


        const imageFile =
            imageInput.files[0];


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!name) {

            alert(
                "Please enter the food name."
            );

            return;
        }


        if (!description) {

            alert(
                "Please enter the food description."
            );

            return;
        }


        if (
            isNaN(price) ||
            price < 0
        ) {

            alert(
                "Please enter a valid price."
            );

            return;
        }


        if (!category) {

            alert(
                "Please select a category."
            );

            return;
        }


        // New food requires an image
        if (
            !editingFoodId &&
            !imageFile
        ) {

            alert(
                "Please choose a food image."
            );

            return;
        }


        // ==================================================
        // IMAGE VALIDATION
        // ==================================================

        if (imageFile) {

            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];


            if (
                !allowedTypes.includes(
                    imageFile.type
                )
            ) {

                alert(
                    "Only JPG, JPEG, PNG and WEBP images are allowed."
                );

                return;
            }


            if (
                imageFile.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "Image must be smaller than 5 MB."
                );

                return;
            }

        }


        // ==================================================
        // CREATE FORMDATA
        // ==================================================

        const formData =
            new FormData();


        formData.append(
            "name",
            name
        );


        formData.append(
            "description",
            description
        );


        formData.append(
            "price",
            price
        );


        formData.append(
            "category",
            category
        );


        formData.append(
            "available",
            available
        );


        // Add image if selected
        if (imageFile) {

            formData.append(
                "image",
                imageFile
            );

        }


        // ==================================================
        // SAVE
        // ==================================================

        const saveButton =
            document.getElementById(
                "save-food-btn"
            );


        try {

            saveButton.disabled = true;

            saveButton.innerText =
                "⏳ Uploading...";


            let response;


            // ==================================================
            // UPDATE EXISTING FOOD
            // ==================================================

            if (editingFoodId) {

                response =
                    await fetch(
                        `${API_URL}/api/food/${editingFoodId}`,
                        {
                            method: "PUT",

                            headers: {
                                "Authorization":
                                    `Bearer ${kitchenToken}`
                            },

                            body: formData
                        }
                    );

            }


            // ==================================================
            // ADD NEW FOOD
            // ==================================================

            else {

                response =
                    await fetch(
                        `${API_URL}/api/food`,
                        {
                            method: "POST",

                            headers: {
                                "Authorization":
                                    `Bearer ${kitchenToken}`
                            },

                            body: formData
                        }
                    );

            }


            const data =
                await response.json();


            // ==================================================
            // AUTHENTICATION FAILURE
            // ==================================================

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem(
                    "kitchenToken"
                );

                window.location.href =
                    "https://oder-food-3.onrender.com/kitchen-login.html";

                return;
            }


            // ==================================================
            // SERVER ERROR
            // ==================================================

            if (!response.ok) {

                alert(
                    data.message ||
                    "Failed to save food."
                );

                return;
            }


            // ==================================================
            // SUCCESS
            // ==================================================

            alert(
                editingFoodId
                    ? "Food updated successfully!"
                    : "Food added successfully!"
            );


            editingFoodId = null;


            foodForm.reset();


            document.getElementById(
                "food-available"
            ).checked = true;


            document.getElementById(
                "food-form-title"
            ).innerText =
                "Add New Food";


            saveButton.innerText =
                "💾 Save Food";


            foodFormContainer.style.display =
                "none";


            await loadFoods();


        } catch (error) {

            console.error(
                "Save food error:",
                error
            );


            alert(
                "Could not connect to server."
            );

        } finally {

            saveButton.disabled = false;

            saveButton.innerText =
                editingFoodId
                    ? "💾 Update Food"
                    : "💾 Save Food";

        }

    }
);


// ======================================================
// EDIT FOOD
// ======================================================

async function editFood(id) {

    try {

        const response =
            await fetch(
                `${API_URL}/api/food/${id}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Could not load food."
            );

            return;
        }


        const food =
            data.food || data;


        editingFoodId =
            food._id;


        document.getElementById(
            "food-form-title"
        ).innerText =
            "Edit Food";


        document.getElementById(
            "save-food-btn"
        ).innerText =
            "💾 Update Food";


        document.getElementById(
            "food-name"
        ).value =
            food.name || "";


        document.getElementById(
            "food-description"
        ).value =
            food.description || "";


        document.getElementById(
            "food-price"
        ).value =
            food.price || "";


        document.getElementById(
            "food-category"
        ).value =
            food.category || "";


        // File input must remain empty.
        // User can choose a new image if needed.
        document.getElementById(
            "food-image"
        ).value = "";


        document.getElementById(
            "food-available"
        ).checked =
            food.available !== false;


        foodFormContainer.style.display =
            "block";


        document.getElementById(
            "food-name"
        ).focus();


    } catch (error) {

        console.error(
            "Edit food error:",
            error
        );


        alert(
            "Could not connect to server."
        );

    }

}


// ======================================================
// MAKE FOOD AVAILABLE / UNAVAILABLE
// ======================================================

async function toggleFoodAvailability(
    id,
    currentAvailability
) {

    const newAvailability =
        !currentAvailability;


    try {

        const response =
            await fetch(
                `${API_URL}/api/food/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${kitchenToken}`
                    },

                    body: JSON.stringify({
                        available:
                            newAvailability
                    })
                }
            );


        const data =
            await response.json();


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "kitchenToken"
            );

            window.location.href =
                "https://oder-food-3.onrender.com/kitchen-login.html";

            return;
        }


        if (!response.ok) {

            alert(
                data.message ||
                "Could not update availability."
            );

            return;
        }


        await loadFoods();


    } catch (error) {

        console.error(
            "Availability error:",
            error
        );


        alert(
            "Could not connect to server."
        );

    }

}


//delete food
async function deleteFood(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this food?"
    );

    if (!confirmed) {
        return;
    }

    // Get the latest token from localStorage
    const token = localStorage.getItem("kitchenToken");

    if (!token) {
        alert("Please login first.");

        window.location.href =
            "https://oder-food-3.onrender.com/kitchen-login.html";

        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/api/food/${id}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        console.log("Delete status:", response.status);
        console.log("Delete response:", data);


        // ==============================
        // AUTHENTICATION ERROR
        // ==============================

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "kitchenToken"
            );

            alert(
                "Your kitchen session has expired. Please login again."
            );

            window.location.href =
                "https://oder-food-3.onrender.com/kitchen-login.html";

            return;
        }


        // ==============================
        // DELETE ERROR
        // ==============================

        if (!response.ok) {

            alert(
                data.message ||
                "Could not delete food."
            );

            return;
        }


        // ==============================
        // SUCCESS
        // ==============================

        alert(
            "Food deleted successfully!"
        );


        // Reload food from database
        await loadFoods();


    } catch (error) {

        console.error(
            "Delete food error:",
            error
        );

        alert(
            "Could not connect to server."
        );
    }
}


// ======================================================
// AUTO REFRESH ORDERS
// ======================================================

setInterval(
    loadOrders,
    10000
);


// ======================================================
// LOGOUT
// ======================================================

const logoutBtn =
    document.getElementById(
        "logout-btn"
    );


logoutBtn.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "kitchenToken"
        );


        window.location.href =
            "https://oder-food-3.onrender.com/kitchen-login.html";

    }
);


// ======================================================
// FIRST LOAD
// ======================================================

loadOrders();

loadFoods();


