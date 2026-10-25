import { auth } from "@/lib/auth/server";

const authHandlers = auth.handler();
type AuthRouteContext = { params: Promise<{ path: string[] }> };

async function isSignUpRequest(request: Request, context: AuthRouteContext) {
  const { path } = await context.params;
  const segments = [...path, ...new URL(request.url).pathname.split("/")];
  return segments.some((segment) => {
    try {
      return decodeURIComponent(segment).toLowerCase() === "sign-up";
    } catch {
      return false;
    }
  });
}

function signUpDisabled() {
  return Response.json({ error: "Public sign-up is disabled." }, { status: 403 });
}

export async function GET(request: Request, context: AuthRouteContext) {
  return await isSignUpRequest(request, context) ? signUpDisabled() : authHandlers.GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  return await isSignUpRequest(request, context) ? signUpDisabled() : authHandlers.POST(request, context);
}

export async function PUT(request: Request, context: AuthRouteContext) {
  return await isSignUpRequest(request, context) ? signUpDisabled() : authHandlers.PUT(request, context);
}

export async function PATCH(request: Request, context: AuthRouteContext) {
  return await isSignUpRequest(request, context) ? signUpDisabled() : authHandlers.PATCH(request, context);
}

export async function DELETE(request: Request, context: AuthRouteContext) {
  return await isSignUpRequest(request, context) ? signUpDisabled() : authHandlers.DELETE(request, context);
}
