import jwt from "jsonwebtoken";

interface GenerateTokenPayload {
  userId: string;
  clinicId: string | null;
  roles: string[];
  isSuperAdmin: boolean;
}

export const generateToken = (
  payload: GenerateTokenPayload
) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET!,
  );
};