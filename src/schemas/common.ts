import { z } from "zod";

/** Unix timestamp (seconds since epoch) as returned by the API */
export const UnixTimestampSchema = z.number().int();

/** Nullable string that defaults to null */
export const NullableString = z.string().nullable();

/** Days of week abbreviations used by the API */
export const DayAbbreviation = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

/** IANA timezone string */
export const TimezoneSchema = z.string();
