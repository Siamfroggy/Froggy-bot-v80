const axios = require("axios");

/**
 * Validates whether cookie contains necessary Facebook session tokens
 * @param {string} cookie Cookie string
 * @param {string} userAgent User agent string
 * @returns {Promise<Boolean>} True if cookie is valid, false if not
 */
module.exports = async function (cookie, userAgent) {
	if (!cookie || typeof cookie !== "string") return false;

	// Must have c_user and xs to be a valid Facebook session
	if (cookie.includes("c_user=") && cookie.includes("xs=")) {
		return true;
	}

	return false;
};