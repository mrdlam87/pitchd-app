// Maximum locations per /api/weather/batch request.
// Imported by both the route (enforces the limit) and fetchWeatherBatch (chunks to this size).
export const WEATHER_MAX_LOCATIONS = 100;
