import { redirect } from "next/navigation";

export default function FeedRedirect() {
  redirect("/friends?tab=activity");
}
