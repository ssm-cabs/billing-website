import { signOutUser } from "@/lib/phoneAuth";

/**
 * POST /api/auth/signout
 * Sign out the current user
 */
export async function POST(request) {
  try {
    await signOutUser();
    return Response.json(
      { message: "Successfully signed out" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error signing out:", error);
    return Response.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
