import { getAccessToken } from "./mpesa.js";

(async () => {
  try {
    const token = await getAccessToken();
    console.log("Access Token:", token);
  } catch (error) {
    console.error("Error generating token:", error.message);
  }
})();
