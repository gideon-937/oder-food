const ordersContainer = document.getElementById("orders-container");
const refreshBtn = document.getElementById("refresh-btn");
const printBtn = document.getElementById("print-btn");

// Keep track of which order IDs we've already seen
let knownOrderIds = new Set();
let isFirstLoad = true;

// Simple alert sound (short beep, base64-encoded, no external file needed)
const alertSound = new Audio(
    "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICAgICAgICA"
);

// Fetch and display orders
async function loadOrders() {
    try {

        const response = await fetch("http://localhost:5000/api/orders");
        const data = await response.json();

        if (!response.ok) {
            ordersContainer.innerHTML = `<p>Error loading orders: ${data.message}</p>`;
            return;
        }

        // Only show orders that have been paid
        const paidOrders = data.orders.filter(order => order.paymentStatus === "Paid");

        if (paidOrders.length === 0) {
            ordersContainer.innerHTML = `<p id="loading-text">No paid orders yet.</p>`;
            knownOrderIds = new Set();
            isFirstLoad = false;
            return;
        }

        // Detect new orders (skip alert on the very first load)
        const newOrders = paidOrders.filter(order => !knownOrderIds.has(order._id));

        if (!isFirstLoad && newOrders.length > 0) {
            alertSound.play().catch(() => {
                // Browsers block autoplay until the user interacts with the page once —
                // clicking Refresh or Print once will unlock sound after that.
            });
        }

        ordersContainer.innerHTML = "";

        paidOrders.forEach(order => {

         const itemsList = (order.items || []).map(item =>
    `<li>${item.quantity} × ${item.name}</li>`
         ).join("");
            const orderTime = new Date(order.createdAt).toLocaleString();
            const isNew = newOrders.some(o => o._id === order._id) && !isFirstLoad;

            const card = document.createElement("div");
            card.className = "order-card" + (isNew ? " new-order" : "");

            card.innerHTML = `
                ${isNew ? `<span class="new-badge">NEW</span>` : ""}
                <h3>Order #${order._id.slice(-6).toUpperCase()}</h3>
                <p class="order-time">${orderTime}</p>
               <p><strong>Phone:</strong> ${order.customer?.phone || "Unknown"}</p>
                <ul class="order-items">${itemsList}</ul>
                <p><strong>Total:</strong> Ksh ${order.totalPrice}</p>
                <p><strong>Status:</strong> ${order.orderStatus}</p>

                <select class="order-status-select" data-id="${order._id}">
                    <option value="Pending" ${order.orderStatus === "Pending" ? "selected" : ""}>Pending</option>
                    <option value="Processing" ${order.orderStatus === "Processing" ? "selected" : ""}>Processing</option>
                    <option value="Ready" ${order.orderStatus === "Ready" ? "selected" : ""}>Ready</option>
                    <option value="Completed" ${order.orderStatus === "Completed" ? "selected" : ""}>Completed</option>
                </select>
            `;

            ordersContainer.appendChild(card);
        });

        // Wire up status dropdowns
        document.querySelectorAll(".order-status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const orderId = e.target.dataset.id;
                const newStatus = e.target.value;
                await updateOrderStatus(orderId, newStatus);
            });
        });

        // Update known order IDs
        knownOrderIds = new Set(paidOrders.map(order => order._id));
        isFirstLoad = false;

    } catch (error) {
        console.error(error);
        ordersContainer.innerHTML = `<p>Could not connect to server.</p>`;
    }
}

// Update order status when staff changes the dropdown
async function updateOrderStatus(orderId, newStatus) {
    try {
        await fetch(`http://localhost:5000/api/orders/${orderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderStatus: newStatus })
        });
    } catch (error) {
        console.error("Failed to update order status:", error);
    }
}

// Manual refresh button
refreshBtn.addEventListener("click", loadOrders);

// Print button
printBtn.addEventListener("click", () => {
    window.print();
});

// Auto-refresh every 10 seconds
setInterval(loadOrders, 10000);

// Initial load
loadOrders();