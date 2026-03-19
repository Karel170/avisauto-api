import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import router from "./routes/index.js";

const app: Express = express();
app.set("trust proxy", 1);
app.use(cors({ 
  origin: ["https://avis-auto-avisauto.vercel.app", "http://localhost:5173"], 
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionSecret = process.env.SESSION_SECRET || "avisauto-dev-secret-change-in-production";
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
  secure: true,
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  sameSite: "none",
},
  })
);

app.use("/api", router);

export default app;
