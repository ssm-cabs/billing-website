import { getUserData } from "@/lib/phoneAuth";

/**
 * GET /api/auth/user-data
 * Fetch user data from authorized_users collection
 * Query params: phone (requires +country-code format)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return Response.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!/^\+\d{10,15}$/.test(phone)) {
      return Response.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const userData = await getUserData(phone);

    if (!userData) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return Response.json(userData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return Response.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
