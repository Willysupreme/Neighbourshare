import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Block } from "@/types";

export async function listMyBlocks(uid: string): Promise<Block[]> {
  const snap = await getDocs(query(collection(db, "blocks"), where("blockerId", "==", uid)));
  return snap.docs.map((d) => d.data() as Block);
}
