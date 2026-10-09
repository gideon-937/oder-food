
// ======================================================
// KITCHEN AUTHENTICATION
// ======================================================

let kitchenToken = localStorage.getItem("kitchenToken");

const API_URL = "https://oder-food-2.onrender.com";
const LOGIN_URL = `${API_URL}/kitchen-login.html`;

if (!kitchenToken) {
    window.location.href = LOGIN_URL;
}


// ======================================================
// ORDERS ELEMENTS
// ======================================================

const ordersContainer = document.getElementById("orders-container");
const refreshBtn = document.getElementById("refresh-btn");
const printBtn = document.getElementById("print-btn");
const totalOrders = document.getElementById("total-orders");
const paidOrdersCount = document.getElementById("paid-orders");
const processingOrders = document.getElementById("processing-orders");
const readyOrders = document.getElementById("ready-orders");
const filterButtons = document.querySelectorAll(".filter-btn");

let allOrders = [];
let knownOrderIds = new Set();
let isFirstLoad = true;

const alertSound = new Audio(
    "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICAgICAgICA"
);


// ======================================================
// AUTHENTICATION HELPER
// ======================================================

function handleAuthenticationFailure() {
    localStorage.removeItem("kitchenToken");
    window.location.href = LOGIN_URL;
}


// ======================================================
// LOAD ORDERS
// ======================================================

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${kitchenToken}`
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleAuthenticationFailure();
            return;
        }

        if (!response.ok) {
            ordersContainer.innerHTML =
                `<p>${data.message || "Could not load orders."}</p>`;
            return;
        }

        allOrders = data.orders || data;

        const paidOrders = allOrders.filter(
            order => order.paymentStatus === "Paid"
        );

        updateDashboard(paidOrders);
        detectNewOrders(paidOrders);
        applyCurrentOrderFilter();

    } catch (error) {
        console.error("Order loading error:", error);
        ordersContainer.innerHTML =
            "<p>Could not connect to server.</p>";
    }
}


// ======================================================
// UPDATE DASHBOARD NUMBERS
// ======================================================

function updateDashboard(orders) {
    totalOrders.innerText = orders.length;

    paidOrdersCount.innerText = orders.filter(
        order => order.paymentStatus === "Paid"
    ).length;

    processingOrders.innerText = orders.filter(
        order => order.orderStatus === "Processing"
    ).length;

    readyOrders.innerText = orders.filter(
        order => order.orderStatus === "Ready"
    ).length;
}


// ======================================================
// DETECT NEW PAID ORDERS
// ======================================================

function detectNewOrders(orders) {
    const newOrders = orders.filter(
        order => !knownOrderIds.has(order._id)
    );

    if (!isFirstLoad && newOrders.length > 0) {
        alertSound.play().catch(() => {});
    }

    knownOrderIds = new Set(
        orders.map(order => order._id)
    );

    isFirstLoad = false;
}


// ======================================================
// APPLY ORDER FILTER
// ======================================================

function applyCurrentOrderFilter() {
    const activeButton = document.querySelector(
        ".filter-btn.active"
    );

    const filter = activeButton
        ? activeButton.dataset.filter
        : "all";

    const paidOrders = allOrders.filter(
        order => order.paymentStatus === "Paid"
    );

    if (filter === "all") {
        displayOrders(paidOrders);
    } else {
        displayOrders(
            paidOrders.filter(
                order => order.orderStatus === filter
            )
        );
    }
}


// ======================================================
// DISPLAY ORDERS
// ======================================================

function displayOrders(orders) {
    if (orders.length === 0) {
        ordersContainer.innerHTML = "<p>No paid orders yet.</p>";
        return;
    }

    ordersContainer.innerHTML = "";

    orders.forEach(order => {
        const itemsList = (order.items || [])
            .map(item => `
                <li>
                    ${Number(item.quantity) || 0} ×
                    ${escapeHTML(item.name || "Food item")}
                </li>
            `)
            .join("");

        const orderTime = new Date(
            order.createdAt
        ).toLocaleString();

        const card = document.createElement("div");
        card.className = "order-card";

        card.innerHTML = `
            <h3>
                Order #${String(order._id).slice(-6).toUpperCase()}
            </h3>

            <p class="order-time">${escapeHTML(orderTime)}</p>

            <p>
                <strong>Customer:</strong>
                ${escapeHTML(order.customer?.name || "Unknown")}
            </p>

            <p>
                <strong>Phone:</strong>
                ${escapeHTML(order.customer?.phone || "Unknown")}
            </p>

            <h4>Items</h4>

            <ul class="order-items">${itemsList}</ul>

            <p>
                <strong>Total:</strong>
                KSh ${Number(order.totalPrice || 0).toLocaleString()}
            </p>

            <p>
                <strong>Payment:</strong>
                ${escapeHTML(order.paymentStatus || "Unknown")}
            </p>

            <p>
                <strong>Status:</strong>
                ${escapeHTML(order.orderStatus || "Pending")}
            </p>

            <select
                class="order-status-select"
                data-id="${escapeHTML(order._id)}"
                aria-label="Update order status"
            >
                <option value="Pending"
                    ${order.orderStatus === "Pending" ? "selected" : ""}>
                    Pending
                </option>

                <option value="Processing"
                    ${order.orderStatus === "Processing" ? "selected" : ""}>
                    Processing
                </option>

                <option value="Ready"
                    ${order.orderStatus === "Ready" ? "selected" : ""}>
                    Ready
                </option>

                <option value="Delivered"
                    ${order.orderStatus === "Delivered" ? "selected" : ""}>
                    Delivered
                </option>
            </select>
        `;

        ordersContainer.appendChild(card);
    });

    document.querySelectorAll(".order-status-select").forEach(select => {
        select.addEventListener("change", event => {
            updateOrderStatus(
                event.target.dataset.id,
                event.target.value
            );
        });
    });
}


// ======================================================
// BASIC HTML ESCAPING
// ======================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

async function updateOrderStatus(id, status) {
    try {
        const response = await fetch(
            `${API_URL}/api/orders/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${kitchenToken}`
                },
                body: JSON.stringify({
                    orderStatus: status
                })
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleAuthenticationFailure();
            return;
        }

        if (!response.ok) {
            alert(data.message || "Could not update order status.");
            return;
        }

        await loadOrders();

    } catch (error) {
        console.error("Order status error:", error);
        alert("Could not connect to server.");
    }
}


// ======================================================
// ORDER FILTER BUTTONS
// ======================================================

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        filterButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        applyCurrentOrderFilter();
    });
});


// ======================================================
// REFRESH AND PRINT
// ======================================================

refreshBtn.addEventListener("click", () => {
    loadOrders();
    loadFoods();
});

printBtn.addEventListener("click", () => {
    window.print();
});


// ======================================================
// FOOD MANAGEMENT ELEMENTS
// ======================================================

const showFoodFormBtn = document.getElementById("show-food-form-btn");
const foodFormContainer = document.getElementById("food-form-container");
const foodForm = document.getElementById("food-form");
const cancelFoodBtn = document.getElementById("cancel-food-btn");
const foodContainer = document.getElementById("food-container");

let editingFoodId = null;


// ======================================================
// RESET FOOD FORM
// ======================================================

function resetFoodForm() {
    editingFoodId = null;
    foodForm.reset();

    document.getElementById("food-available").checked = true;
    document.getElementById("food-stock").value = 0;

    document.getElementById("food-form-title").innerText =
        "Add New Food";

    document.getElementById("save-food-btn").innerText =
        "💾 Save Food";

    document.getElementById("save-food-btn").disabled = false;
}


// ======================================================
// SHOW FOOD FORM
// ======================================================

showFoodFormBtn.addEventListener("click", () => {
    resetFoodForm();

    foodFormContainer.style.display = "block";
    document.getElementById("food-name").focus();
});


// ======================================================
// CANCEL FOOD FORM
// ======================================================

cancelFoodBtn.addEventListener("click", () => {
    resetFoodForm();
    foodFormContainer.style.display = "none";
});


// ======================================================
// LOAD FOODS
// ======================================================

async function loadFoods() {
    try {
        const response = await fetch(`${API_URL}/api/food`);
        const data = await response.json();

        if (!response.ok) {
            foodContainer.innerHTML =
                `<p>${escapeHTML(data.message || "Could not load food.")}</p>`;
            return;
        }

        const foods = Array.isArray(data)
            ? data
            : data.foods || [];

        displayFoods(foods);

    } catch (error) {
        console.error("Food loading error:", error);
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
// DISPLAY FOODS AND REMAINING STOCK
// ======================================================

function displayFoods(foods) {
    if (!foods.length) {
        foodContainer.innerHTML =
            "<p>No food has been added yet.</p>";
        return;
    }

    foodContainer.innerHTML = "";

    foods.forEach(food => {
        const foodCard = document.createElement("div");
        foodCard.className = "food-card";

        const stock = Number(food.stock ?? 0);
        const hasStock = Number.isInteger(stock) && stock > 0;

        const isAvailable = food.available !== false;
        const availabilityText = !isAvailable
            ? "Unavailable"
            : hasStock
                ? "Available"
                : "Out of stock";

        const availabilityClass = !isAvailable || !hasStock
            ? "unavailable"
            : "available";

        const imageUrl = getFoodImageUrl(food.image);

        foodCard.innerHTML = `
            ${
                imageUrl
                    ? `
                        <img
                            src="${escapeHTML(imageUrl)}"
                            alt="${escapeHTML(food.name)}"
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
                <h3>${escapeHTML(food.name)}</h3>

                <p>${escapeHTML(food.description)}</p>

                <p>
                    <strong>
                        KSh ${Number(food.price || 0).toLocaleString()}
                    </strong>
                </p>

                <p>
                    Category:
                    ${escapeHTML(food.category || "Other")}
                </p>

                <p class="food-stock">
                    <strong>Remaining units:</strong>
                    <span>${Number.isInteger(stock) && stock >= 0 ? stock : 0}</span>
                </p>

                <span class="food-status ${availabilityClass}">
                    ${availabilityText}
                </span>
            </div>

            <div class="food-actions">
                <button
                    type="button"
                    class="edit-food-btn"
                    data-id="${escapeHTML(food._id)}">
                    ✏️ Edit
                </button>

                <button
                    type="button"
                    class="toggle-food-btn"
                    data-id="${escapeHTML(food._id)}"
                    data-available="${isAvailable}">
                    ${isAvailable ? "❌ Make Unavailable" : "✅ Make Available"}
                </button>

                <button
                    type="button"
                    class="delete-food-btn"
                    data-id="${escapeHTML(food._id)}">
                    🗑️ Delete
                </button>
            </div>
        `;

        foodContainer.appendChild(foodCard);
    });


    // EDIT BUTTONS

    document.querySelectorAll(".edit-food-btn").forEach(button => {
        button.addEventListener("click", () => {
            editFood(button.dataset.id);
        });
    });


    // AVAILABILITY BUTTONS

    document.querySelectorAll(".toggle-food-btn").forEach(button => {
        button.addEventListener("click", () => {
            toggleFoodAvailability(
                button.dataset.id,
                button.dataset.available === "true"
            );
        });
    });


    // DELETE BUTTONS

    document.querySelectorAll(".delete-food-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteFood(button.dataset.id);
        });
    });
}


// ======================================================
// ADD OR UPDATE FOOD
// ======================================================

foodForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("food-name").value.trim();

    const description = document
        .getElementById("food-description")
        .value.trim();

    const price = Number(
        document.getElementById("food-price").value
    );

    const stock = Number(
        document.getElementById("food-stock").value
    );

    const category = document.getElementById("food-category").value;

    const available = document.getElementById("food-available").checked;

    const imageInput = document.getElementById("food-image");
    const imageFile = imageInput.files[0];


    // VALIDATION

    if (!name) {
        alert("Please enter the food name.");
        return;
    }

    if (!description) {
        alert("Please enter the food description.");
        return;
    }

    if (!Number.isFinite(price) || price < 0) {
        alert("Please enter a valid price.");
        return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
        alert("Available units must be a whole number equal to or greater than zero.");
        document.getElementById("food-stock").focus();
        return;
    }

    if (!category) {
        alert("Please select a category.");
        return;
    }

    if (!editingFoodId && !imageFile) {
        alert("Please choose a food image.");
        return;
    }


    // IMAGE VALIDATION

    if (imageFile) {
        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(imageFile.type)) {
            alert("Only JPG, JPEG, PNG and WEBP images are allowed.");
            return;
        }

        if (imageFile.size > 5 * 1024 * 1024) {
            alert("Image must be smaller than 5 MB.");
            return;
        }
    }


    // CREATE FORMDATA

    const formData = new FormData();

    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", String(price));
    formData.append("stock", String(stock));
    formData.append("category", category);
    formData.append("available", String(available));

    if (imageFile) {
        formData.append("image", imageFile);
    }


    // SAVE FOOD

    const saveButton = document.getElementById("save-food-btn");

    try {
        saveButton.disabled = true;
        saveButton.innerText = "⏳ Saving...";

        let response;

        if (editingFoodId) {
            response = await fetch(
                `${API_URL}/api/food/${editingFoodId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${kitchenToken}`
                    },
                    body: formData
                }
            );
        } else {
            response = await fetch(
                `${API_URL}/api/food`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${kitchenToken}`
                    },
                    body: formData
                }
            );
        }

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleAuthenticationFailure();
            return;
        }

        if (!response.ok) {
            alert(data.message || "Failed to save food.");
            return;
        }

        alert(
            editingFoodId
                ? "Food and stock updated successfully!"
                : "Food added successfully!"
        );

        resetFoodForm();
        foodFormContainer.style.display = "none";

        await loadFoods();

    } catch (error) {
        console.error("Save food error:", error);
        alert("Could not connect to server.");

    } finally {
        saveButton.disabled = false;

        if (editingFoodId) {
            saveButton.innerText = "💾 Update Food";
        } else {
            saveButton.innerText = "💾 Save Food";
        }
    }
});


// ======================================================
// EDIT FOOD
// ======================================================

async function editFood(id) {
    try {
        const response = await fetch(`${API_URL}/api/food/${id}`);
        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Could not load food.");
            return;
        }

        const food = data.food || data;

        editingFoodId = food._id;

        document.getElementById("food-form-title").innerText =
            "Edit Food";

        document.getElementById("save-food-btn").innerText =
            "💾 Update Food";

        document.getElementById("food-name").value =
            food.name || "";

        document.getElementById("food-description").value =
            food.description || "";

        document.getElementById("food-price").value =
            food.price ?? "";

        document.getElementById("food-stock").value =
            Number(food.stock ?? 0);

        document.getElementById("food-category").value =
            food.category || "";

        document.getElementById("food-image").value = "";

        document.getElementById("food-available").checked =
            food.available !== false;

        foodFormContainer.style.display = "block";
        document.getElementById("food-name").focus();

    } catch (error) {
        console.error("Edit food error:", error);
        alert("Could not connect to server.");
    }
}


// ======================================================
// MAKE FOOD AVAILABLE / UNAVAILABLE
// ======================================================

async function toggleFoodAvailability(id, currentAvailability) {
    const newAvailability = !currentAvailability;

    try {
        const response = await fetch(
            `${API_URL}/api/food/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${kitchenToken}`
                },
                body: JSON.stringify({
                    available: newAvailability
                })
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleAuthenticationFailure();
            return;
        }

        if (!response.ok) {
            alert(data.message || "Could not update availability.");
            return;
        }

        await loadFoods();

    } catch (error) {
        console.error("Availability error:", error);
        alert("Could not connect to server.");
    }
}


// ======================================================
// DELETE FOOD
// ======================================================

async function deleteFood(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this food?"
    );

    if (!confirmed) {
        return;
    }

    const token = localStorage.getItem("kitchenToken");

    if (!token) {
        alert("Please login first.");
        handleAuthenticationFailure();
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/api/food/${id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            alert("Your kitchen session has expired. Please login again.");
            handleAuthenticationFailure();
            return;
        }

        if (!response.ok) {
            alert(data.message || "Could not delete food.");
            return;
        }

        alert("Food deleted successfully!");
        await loadFoods();

    } catch (error) {
        console.error("Delete food error:", error);
        alert("Could not connect to server.");
    }
}


// ======================================================
// AUTO-REFRESH ORDERS
// ======================================================

setInterval(loadOrders, 10000);


// ======================================================
// LOGOUT
// ======================================================

document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("kitchenToken");
    window.location.href = LOGIN_URL;
});


// ======================================================
// FIRST LOAD
// ======================================================

/* Automatically refresh food stock every 15 seconds.
   This allows the kitchen to see changes made by customers'
   orders without manually refreshing the page. */

setInterval(() => {
    loadFoods();
}, 15000);

loadOrders();
loadFoods();

