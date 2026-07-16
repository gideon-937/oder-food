import { stkPush } from "./mpesa.js";

(async () => {
  try {
    const response = await stkPush(
      "254708374149",   // sandbox test phone number
      1                 // amount
    );
    console.log("STK Push Response:", response);
  } catch (error) {
    console.error("Error sending STK Push:", error.message);
  }
})();
