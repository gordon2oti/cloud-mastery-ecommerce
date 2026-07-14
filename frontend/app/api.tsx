import axios from "axios";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api/v1";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

// Combined Express Node service (Cart & Checkout)
const rawCartUrl = process.env.NEXT_PUBLIC_CART_API_URL || "https://checkout-service-659303448426.us-central1.run.app";
export const CART_API_URL = rawCartUrl.replace(/\/+$/, "");

import { CustomersType } from "./types/CustomersType";

export type CreateCustomerPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
};

export const getProducts = async () => {
  const res = await axios.get(`${API_URL}/products`);
  return res.data;
};

export const getFinanceProducts = async () => {
  const res = await axios.get(`${API_URL}/finance-products`);
  return res.data;
};

export const getCarParts = async () => {
  const res = await axios.get(`${API_URL}/car-parts`);
  return res.data;
};

export const getCustomers = async () => {
  const res = await axios.get(`${API_URL}/customers`);
  return res.data;
};

export const addCustomer = async (customer: CreateCustomerPayload) => {
  const res = await axios.post(`${API_URL}/customers`, customer);
  return res.data;
};

export const deleteCustomer = async (customerId: string) => {
  const res = await axios.delete(`${API_URL}/customers/${customerId}`);
  return res.data;
};

export const getOrders = async () => {
  const res = await axios.get(`${API_URL}/orders`);
  return res.data;
};
export const addOrder = async (order: object) => {
  const res = await axios.post(`${API_URL}/orders`, order);
  return res.data;
};

export const deleteOrder = async (orderId: string) => {
  const res = await axios.delete(`${API_URL}/orders/${orderId}`);
  return res.data;
};

// ─── Cart / Session API (Python Cloud Run) ───────────────────────────────────

export interface CartItem {
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
  lineTotalKes: number;
}

export interface CartResponse {
  success: boolean;
  cart: { items: CartItem[]; subtotalKes: number };
}

export const createSession = async (payload: {
  sessionId: string;
  name: string;
  phone: string;
  location: string;
}) => {
  const res = await axios.post(`${CART_API_URL}/session`, payload);
  return res.data;
};

export const getCartFromApi = async (sessionId: string): Promise<CartResponse> => {
  const res = await axios.get(`${CART_API_URL}/cart/${sessionId}`);
  return res.data;
};

export const addToCartApi = async (payload: {
  sessionId: string;
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
}) => {
  const { sessionId, ...body } = payload;
  const res = await axios.post(`${CART_API_URL}/addToCart?sessionId=${sessionId}`, body);
  return res.data;
};

export const modifyCartApi = async (payload: {
  sessionId: string;
  productId: string;
  quantity: number;
}) => {
  const { sessionId, ...body } = payload;
  const res = await axios.post(`${CART_API_URL}/modifyCart?sessionId=${sessionId}`, body);
  return res.data;
};

export const removeCartItemApi = async (sessionId: string, productId: string) => {
  const res = await axios.post(`${CART_API_URL}/modifyCart?sessionId=${sessionId}`, {
    productId,
    quantity: 0
  });
  return res.data;
};

// ─── Express Checkout API ───────────────────────────────────────────────────
const rawExpressUrl = process.env.NEXT_PUBLIC_EXPRESS_API_URL || rawCartUrl || "http://localhost:8080";
export const EXPRESS_API_URL = rawExpressUrl.replace(/\/+$/, "");

export const checkoutCartApi = async (sessionId: string) => {
  const res = await axios.post(`${EXPRESS_API_URL}/checkout?sessionId=${sessionId}`);
  return res.data;
};
