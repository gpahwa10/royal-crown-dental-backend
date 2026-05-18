import jwt from "jsonwebtoken";

interface GenerateTokenPayload {
  id: string;
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