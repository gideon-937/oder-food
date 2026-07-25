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


// Notification sound
const alertSound = new Audio(
"data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICAgICAgICA"
);


// Load orders
async function loadOrders(){

    try{

        const response = await fetch(
            "http://localhost:5000/api/orders"
        );


        const data = await response.json();


        if(!response.ok){

            ordersContainer.innerHTML =
            `<p>${data.message}</p>`;

            return;
        }



        // Supports both {orders:[]} and []
        allOrders = data.orders || data;


        // Only paid orders go to kitchen
        const paidOrders = allOrders.filter(
            order => order.paymentStatus === "Paid"
        );


        updateDashboard(paidOrders);


        detectNewOrders(paidOrders);


        displayOrders(paidOrders);



    }catch(error){

        console.error(error);

        ordersContainer.innerHTML =
        "<p>Could not connect to server.</p>";
    }

}



// Update dashboard numbers
function updateDashboard(orders){


    totalOrders.innerText = orders.length;


    paidOrdersCount.innerText =
    orders.filter(
        order => order.paymentStatus === "Paid"
    ).length;



    processingOrders.innerText =
    orders.filter(
        order => order.orderStatus === "Processing"
    ).length;



    readyOrders.innerText =
    orders.filter(
        order => order.orderStatus === "Ready"
    ).length;

}



// Detect new paid orders
function detectNewOrders(orders){


    const newOrders = orders.filter(
        order => !knownOrderIds.has(order._id)
    );


    if(!isFirstLoad && newOrders.length > 0){

        alertSound.play().catch(()=>{});

    }


    knownOrderIds = new Set(
        orders.map(order => order._id)
    );


    isFirstLoad = false;

}




// Display orders
function displayOrders(orders){


    if(orders.length === 0){

        ordersContainer.innerHTML =
        "<p>No paid orders yet.</p>";

        return;

    }



    ordersContainer.innerHTML = "";



    orders.forEach(order => {


        const itemsList =
        (order.items || [])
        .map(item =>
            `<li>
            ${item.quantity} × ${item.name}
            </li>`
        )
        .join("");



        const orderTime =
        new Date(order.createdAt)
        .toLocaleString();



        const card =
        document.createElement("div");


        card.className="order-card";



        card.innerHTML = `


        <h3>
        Order #${order._id.slice(-6).toUpperCase()}
        </h3>


        <p class="order-time">
        ${orderTime}
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
        Ksh ${order.totalPrice}
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
        data-id="${order._id}">


        <option value="Pending"
        ${order.orderStatus==="Pending"?"selected":""}>
        Pending
        </option>



        <option value="Processing"
        ${order.orderStatus==="Processing"?"selected":""}>
        Processing
        </option>



        <option value="Ready"
        ${order.orderStatus==="Ready"?"selected":""}>
        Ready
        </option>



        <option value="Delivered"
        ${order.orderStatus==="Delivered"?"selected":""}>
        Delivered
        </option>


        </select>


        `;


        ordersContainer.appendChild(card);


    });



    // Status change listener
    document.querySelectorAll(".order-status-select")
    .forEach(select=>{


        select.addEventListener(
            "change",
            (event)=>{


                updateOrderStatus(
                    event.target.dataset.id,
                    event.target.value
                );


            }
        );


    });



}



// Update order status
async function updateOrderStatus(id,status){


    try{


        await fetch(
        `http://localhost:5000/api/orders/${id}`,
        {

            method:"PUT",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                orderStatus:status

            })

        });



        loadOrders();



    }catch(error){

        console.error(error);

    }

}




// Filter buttons
filterButtons.forEach(button=>{


    button.addEventListener("click",()=>{


        filterButtons.forEach(btn=>
            btn.classList.remove("active")
        );


        button.classList.add("active");



        const filter =
        button.dataset.filter;



        const paidOrders =
        allOrders.filter(
        order=>order.paymentStatus==="Paid"
        );



        if(filter==="all"){

            displayOrders(paidOrders);

        }
        else{

            displayOrders(
            paidOrders.filter(
            order=>order.orderStatus===filter
            )
            );

        }



    });



});





refreshBtn.addEventListener(
"click",
loadOrders
);



printBtn.addEventListener(
"click",
()=>window.print()
);



// Auto refresh
setInterval(
loadOrders,
10000
);


// First load
loadOrders();