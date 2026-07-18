import axios from "axios";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

/**
 * Format phone number to 2547XXXXXXXX
 */
export const formatPhone = (phone) => {
  phone = phone.toString().trim();

  if (phone.startsWith("0")) return "254" + phone.substring(1);
  if (phone.startsWith("+254")) return phone.substring(1);
  if (phone.startsWith("254")) return phone;

  throw new Error("Invalid phone number format.");
};

/**
 * Generate M-Pesa Password and Timestamp
 */
export const generatePassword = () => {
  const timestamp = moment().format("YYYYMMDDHHmmss");
  const password = Buffer.from(
    process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp
  ).toString("base64");

  return { password, timestamp };
};

/**
 * Get OAuth Access Token
 */
export const getAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("Failed to get access token:", error.response?.data || error.message);
    throw new Error("Unable to generate M-Pesa access token.");
  }
};

/**
 * Send STK Push Request
 */
export const stkPush = async (phone, amount, orderId = "Food Order") => {
  try {
    if (!phone) throw new Error("Phone number is required.");
    if (!amount || amount <= 0) throw new Error("Invalid payment amount.");

    phone = formatPhone(phone);
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();
    console.log("Callback URL:", process.env.MPESA_CALLBACK_URL);

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(amount),
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: orderId,
      TransactionDesc: "Food Payment",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    throw error;
  }
};
