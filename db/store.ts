import { env } from "cloudflare:workers";

export function db() {
  if (!env.DB) throw Error("Database unavailable");
  return env.DB as D1Database;
}

export const branches = ["Camden", "Brixton", "Islington"] as const;
const catalog = [
  { name: "Chicken fillets", category: "Food", unit: "kg", quantity: 6, minimum: 12, price: 8.5, storage: "Chiller" },
  { name: "Burger buns", category: "Food", unit: "packs", quantity: 3, minimum: 6, price: 4.2, storage: "Dry store" },
  { name: "Takeaway boxes", category: "Packaging", unit: "packs", quantity: 8, minimum: 5, price: 11, storage: "Dry store" },
  { name: "Cooking oil", category: "Food", unit: "litres", quantity: 4, minimum: 5, price: 3.8, storage: "Dry store" },
  { name: "Soft drinks", category: "Drinks", unit: "cases", quantity: 12, minimum: 6, price: 18, storage: "Dry store" },
  { name: "Sanitiser", category: "Cleaning", unit: "bottles", quantity: 2, minimum: 3, price: 5.5, storage: "Cleaning cupboard" },
] as const;

export async function ensureDemo(id: string) {
  const d = db();
  if (await d.prepare("SELECT 1 FROM demos WHERE id=?").bind(id).first()) return;
  const created = await d.prepare("INSERT OR IGNORE INTO demos(id) VALUES (?)").bind(id).run();
  if (created.meta.changes !== 1) return;
  for (const branch of branches) {
    for (const item of catalog) {
      await d.prepare("INSERT OR IGNORE INTO items(demo_id,branch,name,category,unit,quantity,minimum,price,storage) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, branch, item.name, item.category, item.unit, item.quantity, item.minimum, item.price, item.storage).run();
      await d.prepare("INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,'opening',?)")
        .bind(id,branch,item.name,item.quantity,"Fictional opening stock balance",item.price).run();
    }
  }
  const lookup = async (branch: string, name: string) => {
    const item = await d.prepare("SELECT id FROM items WHERE demo_id=? AND branch=? AND name=?").bind(id, branch, name).first<{id: number}>();
    if (!item) throw Error("Could not create sample data");
    return item.id;
  };
  const makeOrder = async (branch: string, supplier: string, status: string, lines: {name:string;quantity:number;price:number;received:number}[]) => {
    const order = await d.prepare("INSERT INTO orders(demo_id,branch,supplier,status,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)").bind(id, branch, supplier, status).run();
    const orderId = Number(order.meta.last_row_id);
    for (const line of lines) {
      await d.prepare("INSERT INTO order_lines(demo_id,order_id,item_id,name,quantity,price,received) VALUES (?,?,?,?,?,?,?)")
        .bind(id, orderId, await lookup(branch, line.name), line.name, line.quantity, line.price, line.received).run();
    }
    return orderId;
  };
  await makeOrder("Camden", "Northfield Foods", "pending", [
    {name:"Chicken fillets",quantity:18,price:8.35,received:0},
    {name:"Burger buns",quantity:10,price:4.10,received:0},
    {name:"Cooking oil",quantity:8,price:3.75,received:0},
  ]);
  const partial = await makeOrder("Brixton", "Northfield Foods", "partial", [
    {name:"Chicken fillets",quantity:16,price:8.5,received:8},
    {name:"Burger buns",quantity:8,price:4.2,received:8},
  ]);
  await d.prepare("INSERT INTO deliveries(demo_id,branch,order_id,summary,note,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)")
    .bind(id,"Brixton",partial,"Chicken fillets: 8 kg; Burger buns: 8 packs","Chicken short by 8 kg; supplier to follow up").run();
  const received = await makeOrder("Islington", "Metro Supplies", "received", [
    {name:"Takeaway boxes",quantity:5,price:10.75,received:5},
    {name:"Soft drinks",quantity:4,price:17.5,received:4},
  ]);
  await d.prepare("INSERT INTO deliveries(demo_id,branch,order_id,summary,note,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)")
    .bind(id,"Islington",received,"Takeaway boxes: 5 packs; Soft drinks: 4 cases","Counted against the delivery note").run();
  await d.prepare("INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?)")
    .bind(id,"Brixton","Chicken fillets",8,`Received order #${partial}`,"delivery",8.5).run();
  await d.prepare("UPDATE items SET quantity=quantity+8 WHERE demo_id=? AND branch='Brixton' AND name='Chicken fillets'").bind(id).run();
  await d.prepare("INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?)")
    .bind(id,"Brixton","Burger buns",8,`Received order #${partial}`,"delivery",4.2).run();
  await d.prepare("UPDATE items SET quantity=quantity+8 WHERE demo_id=? AND branch='Brixton' AND name='Burger buns'").bind(id).run();
  await d.prepare("INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?)")
    .bind(id,"Islington","Takeaway boxes",5,`Received order #${received}`,"delivery",10.75).run();
  await d.prepare("UPDATE items SET quantity=quantity+5, price=10.75 WHERE demo_id=? AND branch='Islington' AND name='Takeaway boxes'").bind(id).run();
  await d.prepare("INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,?)")
    .bind(id,"Islington","Soft drinks",4,`Received order #${received}`,"delivery",17.5).run();
  await d.prepare("UPDATE items SET quantity=quantity+4, price=17.5 WHERE demo_id=? AND branch='Islington' AND name='Soft drinks'").bind(id).run();
}
