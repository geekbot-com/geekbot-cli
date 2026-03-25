import packageJson from "../../package.json";

export const APP_NAME = "geekbot";
export const APP_VERSION: string = packageJson.version;
export const API_BASE_URL = process.env.GEEKBOT_API_BASE_URL ?? "https://api.geekbot.com";
