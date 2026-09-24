const loginForm = document.getElementById("login-form");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Logging in...";

    try {

        const response = await fetch(
            "https://oder-food-2.onrender.com/api/users/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.message || "Login failed.";
            return;
        }

        // Check that this is actually a kitchen account
        if (data.user.role !== "kitchen") {
            message.textContent = "You are not authorized to access the kitchen dashboard.";
            return;
        }

        // Save JWT token
        localStorage.setItem("kitchenToken", data.token);

        // Open existing kitchen dashboard
       window.location.href = "https://oder-food-3.onrender.com/kitchen.html";

    } catch (error) {

        console.error(error);

        message.textContent =
            "Unable to connect to the server.";
    }
});