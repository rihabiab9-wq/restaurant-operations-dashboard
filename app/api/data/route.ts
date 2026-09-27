import { cookies } from "next/headers";
import { db, ensureDemo } from "@/db/store";

export const runtime = "edge";

export async function GET() {
  try {
    const jar = await cookies();
    let id = jar.get("restaurant-demo")?.value;
    const newVisitor = !id;
    if (!id) id = crypto.randomUUID();
    await ensureDemo(id);
    const d = db();
    const [items, orders, lines, movements, deliveries] = await Promise.all([
      d.prepare("SELECT id,branch,name,category,unit,quantity,minimum,price,storage FROM items WHERE demo_id=? ORDER BY branch,category,name").bind(id).all(),
      d.prepare("SELECT id,branch,supplier,status,created_at FROM orders WHERE demo_id=? ORDER BY id DESC").bind(id).all(),
      d.prepare("SELECT id,order_id,item_id,name,quantity,price,received FROM order_lines WHERE demo_id=? ORDER BY id").bind(id).all(),
      d.prepare("SELECT id,branch,item,delta,note,created_at,kind,unit_cost FROM movements WHERE demo_id=? ORDER BY id DESC LIMIT 250").bind(id).all(),
      d.prepare("SELECT id,branch,order_id,summary,note,created_at FROM deliveries WHERE demo_id=? ORDER BY id DESC LIMIT 100").bind(id).all(),
    ]);
    const joined = (orders.results as {id:number}[]).map(order => ({
      ...order,
      lines: (lines.results as {order_id:number}[]).filter(line => line.order_id === order.id),
    }));
    const response = Response.json({items:items.results,orders:joined,movements:movements.results,deliveries:deliveries.results});
    if (newVisitor) response.headers.append("Set-Cookie",`restaurant-demo=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
    return response;
  } catch (error) {
    console.error("Restaurant demo load failed",error);
    return Response.json({error:"The demo is temporarily unavailable. Please try again."},{status:503});
  }
}
