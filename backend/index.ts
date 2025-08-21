import express from "express";
import bodyParser from "body-parser";
import router from "./src/routes/flowchartRoutes";
import cors from "cors";

const app = express();
app.use(cors())
app.use(bodyParser.json());
app.use("/api", router);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
