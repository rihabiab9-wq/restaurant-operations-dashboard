import { cookies } from "next/headers";
import { branches, db, ensureDemo } from "@/db/store";

export const runtime = "edge";
type Input = Record<string, unknown>;
const str = (v: unknown, max = 100) => typeof v === "string" ? v.trim().slice(0, max) : "";
const number = (v: unknown) => v === "" || v === null || v === undefined ? NaN : Number(v);
const valid = (v: number, minimum = 0) => Number.isFinite(v) && v >= minimum && v <= 100000;
const qty = (v: number) => Math.round(v * 100) / 100;
const fail = (message: string): never => { throw Error(message); };

export async function POST(request: Request) {
  try {
    const id = (await cookies()).get("restaurant-demo")?.value;
    if (!id) return Response.json({error:"Refresh the page to start the demo."}, {status:400});
    const input = await request.json() as Input;
    const branch = str(input.branch);
    if (!branches.some(b => b === branch)) fail("Choose a valid branch.");
    const d = db();

    if (input.action === "reset") {
      await d.batch([
        d.prepare("DELETE FROM deliveries WHERE demo_id=?").bind(id),
        d.prepare("DELETE FROM movements WHERE demo_id=?").bind(id),
        d.prepare("DELETE FROM order_lines WHERE demo_id=?").bind(id),
        d.prepare("DELETE FROM orders WHERE demo_id=?").bind(id),
        d.prepare("DELETE FROM items WHERE demo_id=?").bind(id),
        d.prepare("DELETE FROM demos WHERE id=?").bind(id),
      ]);
      await ensureDemo(id);
    }
    else if (input.action === "add_item") {
      const name = str(input.name,80), category = str(input.category,30), unit = str(input.unit,20), storage = str(input.storage,50);
      const quantity = number(input.quantity), minimum = number(input.minimum), price = number(input.price);
      if (!name || !category || !unit || !storage || ![quantity,minimum,price].every(v => valid(v))) fail("Complete every field with non-negative numbers.");
      if (await d.prepare("SELECT id FROM items WHERE demo_id=? AND branch=? AND lower(name)=lower(?)").bind(id,branch,name).first()) fail("That item already exists in this branch.");
      await d.prepare("INSERT INTO items(demo_id,branch,name,category,unit,quantity,minimum,price,storage) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,branch,name,category,unit,qty(quantity),qty(minimum),qty(price),storage).run();
    }
    else if (input.action === "count" || input.action === "waste") {
      const itemId = number(input.item_id), amount = number(input.amount), note = str(input.note,160);
      const item = await d.prepare("SELECT name,quantity,price FROM items WHERE id=? AND demo_id=? AND branch=?").bind(itemId,id,branch).first<{name:string;quantity:number;price:number}>();
      if (!item || !valid(amount) || !note) throw Error("Choose an item, a valid quantity and a reason.");
      const delta = input.action === "count" ? qty(amount - item.quantity) : -qty(amount);
      if (input.action === "waste" && (amount <= 0 || amount > item.quantity)) fail("Waste must be greater than zero and no more than stock on hand.");
      if (delta === 0) fail("The counted quantity already matches the recorded stock.");
      const condition = input.action === "count" ? "quantity=?" : "quantity>=?";
      const expected = input.action === "count" ? item.quantity : qty(amount);
      const check = `EXISTS (SELECT 1 FROM items WHERE id=? AND demo_id=? AND branch=? AND ${condition})`;
      const changed = await d.batch([
        d.prepare(`INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP,?,? WHERE ${check}`)
          .bind(id,branch,item.name,delta,note,input.action,item.price,itemId,id,branch,expected),
        d.prepare(`UPDATE items SET quantity=quantity+? WHERE id=? AND demo_id=? AND branch=? AND ${condition}`)
          .bind(delta,itemId,id,branch,expected),
      ]);
      if (changed[1].meta.changes !== 1) fail("Stock changed while you were working. Refresh and try again.");
    }
    else if (input.action === "transfer") {
      const itemId = number(input.item_id), amount = number(input.amount), to = str(input.to), note = str(input.note,160);
      if (!branches.some(b => b === to) || to === branch || !valid(amount,0.01) || !note) fail("Choose another branch, a quantity and a reason.");
      const fromItem = await d.prepare("SELECT id,name,unit,quantity,price FROM items WHERE id=? AND demo_id=? AND branch=?").bind(itemId,id,branch).first<{id:number;name:string;unit:string;quantity:number;price:number}>();
      if (!fromItem || amount > fromItem.quantity) throw Error("The source branch does not have enough stock.");
      const target = await d.prepare("SELECT id FROM items WHERE demo_id=? AND branch=? AND name=? AND unit=?").bind(id,to,fromItem.name,fromItem.unit).first<{id:number}>();
      if (!target) throw Error("The receiving branch needs the same item and unit in its stock list.");
      const available = "EXISTS (SELECT 1 FROM items WHERE id=? AND demo_id=? AND quantity>=?)";
      const transfers = await d.batch([
        d.prepare(`UPDATE items SET quantity=quantity+? WHERE id=? AND demo_id=? AND ${available}`).bind(qty(amount),target.id,id,itemId,id,qty(amount)),
        d.prepare(`INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP,'transfer',? WHERE ${available}`).bind(id,branch,fromItem.name,-qty(amount),`To ${to}: ${note}`,fromItem.price,itemId,id,qty(amount)),
        d.prepare(`INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP,'transfer',? WHERE ${available}`).bind(id,to,fromItem.name,qty(amount),`From ${branch}: ${note}`,fromItem.price,itemId,id,qty(amount)),
        d.prepare("UPDATE items SET quantity=quantity-? WHERE id=? AND demo_id=? AND quantity>=?").bind(qty(amount),itemId,id,qty(amount)),
      ]);
      if (transfers[3].meta.changes !== 1) fail("Stock changed. Refresh and try again.");
    }
    else if (input.action === "create_order") {
      const supplier = str(input.supplier,80), raw = input.lines;
      if (!supplier || !Array.isArray(raw) || raw.length < 1 || raw.length > 12) fail("Add a supplier and 1 to 12 order lines.");
      const lines = (raw as Input[]).map((entry: Input) => ({item_id:number(entry.item_id), quantity:number(entry.quantity), price:number(entry.price)}));
      if (lines.some(l => !Number.isInteger(l.item_id) || !valid(l.quantity,0.01) || !valid(l.price))) fail("Each line needs an item, quantity and valid unit price.");
      if (new Set(lines.map(l => l.item_id)).size !== lines.length) fail("Each item can appear only once in an order.");
      const itemRecords = await Promise.all(lines.map(l => d.prepare("SELECT id,name FROM items WHERE id=? AND demo_id=? AND branch=?").bind(l.item_id,id,branch).first<{id:number;name:string}>()));
      if (itemRecords.some(x => !x)) fail("An order item is no longer available in this branch.");
      const order = await d.prepare("INSERT INTO orders(demo_id,branch,supplier,status,created_at) VALUES (?,?,?,'pending',CURRENT_TIMESTAMP)").bind(id,branch,supplier).run();
      const orderId = Number(order.meta.last_row_id);
      await d.batch(lines.map((line,index) => d.prepare("INSERT INTO order_lines(demo_id,order_id,item_id,name,quantity,price,received) VALUES (?,?,?,?,?,?,0)")
        .bind(id,orderId,line.item_id,itemRecords[index]!.name,qty(line.quantity),qty(line.price))));
    }
    else if (input.action === "receive") {
      const orderId = number(input.order_id), raw = input.lines, note = str(input.note,220);
      if (!Number.isInteger(orderId) || !Array.isArray(raw) || !note) fail("Enter received quantities and a delivery note.");
      const order = await d.prepare("SELECT status FROM orders WHERE id=? AND demo_id=? AND branch=?").bind(orderId,id,branch).first<{status:string}>();
      if (!order || !["pending","partial"].includes(order.status)) fail("This order is closed or unavailable.");
      const recorded = (await d.prepare("SELECT id,item_id,name,quantity,received,price FROM order_lines WHERE order_id=? AND demo_id=? ORDER BY id").bind(orderId,id).all()).results as {id:number;item_id:number;name:string;quantity:number;received:number;price:number}[];
      const entries = raw as Input[];
      const amounts = entries.map(x => ({line_id:number(x.line_id), amount:number(x.amount)}));
      if (amounts.length !== recorded.length || new Set(amounts.map(x=>x.line_id)).size !== recorded.length || amounts.some(x=>!Number.isInteger(x.line_id)||!valid(x.amount))) fail("Enter a valid received quantity for every line.");
      let total = 0; const summary: string[] = [];
      for (const line of recorded) {
        const entry = amounts.find(x=>x.line_id===line.id);
        if (!entry || qty(entry.amount) > qty(line.quantity-line.received)) throw Error(`Too much received for ${line.name}.`);
        if (entry.amount > 0) { total += entry.amount; summary.push(`${line.name}: ${qty(entry.amount)}`); }
      }
      if (total <= 0) fail("Record at least one item received. Note rejected or missing goods separately.");
      const complete = recorded.every(line => {
        const entry = amounts.find(x=>x.line_id===line.id)!;
        return qty(line.received+entry.amount) >= line.quantity;
      });
      const pending = "EXISTS (SELECT 1 FROM orders WHERE id=? AND demo_id=? AND branch=? AND status IN ('pending','partial'))";
      const statements: D1PreparedStatement[] = [];
      for (const line of recorded) {
        const amount = qty(amounts.find(x=>x.line_id===line.id)!.amount);
        if (amount <= 0) continue;
        statements.push(d.prepare(`UPDATE order_lines SET received=received+? WHERE id=? AND demo_id=? AND received+?<=quantity AND ${pending}`)
          .bind(amount,line.id,id,amount,orderId,id,branch));
        statements.push(d.prepare(`UPDATE items SET quantity=quantity+?,price=? WHERE id=? AND demo_id=? AND branch=? AND ${pending}`)
          .bind(amount,line.price,line.item_id,id,branch,orderId,id,branch));
        statements.push(d.prepare(`INSERT INTO movements(demo_id,branch,item,delta,note,created_at,kind,unit_cost) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP,'delivery',? WHERE ${pending}`)
          .bind(id,branch,line.name,amount,`Received order #${orderId}: ${note}`,line.price,orderId,id,branch));
      }
      statements.push(d.prepare(`INSERT INTO deliveries(demo_id,branch,order_id,summary,note,created_at) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP WHERE ${pending}`)
        .bind(id,branch,orderId,summary.join("; "),note,orderId,id,branch));
      statements.push(d.prepare("UPDATE orders SET status=? WHERE id=? AND demo_id=? AND branch=? AND status IN ('pending','partial')")
        .bind(complete?"received":"partial",orderId,id,branch));
      const result = await d.batch(statements);
      if (result[result.length-1].meta.changes !== 1) fail("This delivery was already recorded. Refresh the order.");
    }
    else if (input.action === "close_order") {
      const orderId = number(input.order_id);
      const result = await d.prepare("UPDATE orders SET status='closed' WHERE id=? AND demo_id=? AND branch=? AND status IN ('pending','partial')").bind(orderId,id,branch).run();
      if (result.meta.changes !== 1) fail("This order is already closed.");
    }
    else fail("Unknown action.");
    return Response.json({ok:true});
  } catch (error) {
    console.error("Restaurant demo action failed", error);
    return Response.json({error:error instanceof Error?error.message:"Could not save the change."}, {status:400});
  }
}
