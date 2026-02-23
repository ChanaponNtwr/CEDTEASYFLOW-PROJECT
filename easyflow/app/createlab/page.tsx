import { Suspense } from "react";
import CreateLabPage from "./CreateLabPage";

export default function Createlab() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateLabPage />
    </Suspense>
  );
}