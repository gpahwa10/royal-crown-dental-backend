import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    employee?: {
        id: string;
        clinicId: string;
        roles: string[];
        isSuperAdmin: boolean;
    };
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;
  
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: "Authorization token missing"
        });
      }
  
      const token = authHeader.split(" ")[1];
  
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Invalid token format"
        });
      }
  
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as AuthRequest["employee"];
  
      req.employee = decoded;
  
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access"
      });
    }
  };