
const express=require("express");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const nodemailer=require("nodemailer");

const app=express();
const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const BUNDLED_DATA=path.join(ROOT,"data");
const DATA=process.env.DATA_DIR||BUNDLED_DATA;
const ORDERS=path.join(DATA,"orders.json");
const MENU=path.join(BUNDLED_DATA,"menu.json");
fs.mkdirSync(DATA,{recursive:true});
if(!fs.existsSync(ORDERS))fs.writeFileSync(ORDERS,"[]");

app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(ROOT,"public")));

const readOrders=()=>JSON.parse(fs.readFileSync(ORDERS,"utf8"));
const writeOrders=o=>fs.writeFileSync(ORDERS,JSON.stringify(o,null,2));
const orderNo=()=>`7L-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

function adminAuth(req,res,next){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Basic ")){res.set("WWW-Authenticate",'Basic realm="7Layers Admin"');return res.status(401).send("Admin login required");}
  const decoded=Buffer.from(h.slice(6),"base64").toString();
  const [u,p]=decoded.split(":");
  if(u!==(process.env.ADMIN_USER||"admin")||p!==(process.env.ADMIN_PASS||"change-me")){
    res.set("WWW-Authenticate",'Basic realm="7Layers Admin"');return res.status(401).send("Invalid admin credentials");
  }
  next();
}

async function sendEmail(order){
  const {SMTP_HOST,SMTP_PORT=587,SMTP_USER,SMTP_PASS,BAKERY_EMAIL}=process.env;
  if(!SMTP_HOST||!SMTP_USER||!SMTP_PASS||!BAKERY_EMAIL)return false;
  const transporter=nodemailer.createTransport({host:SMTP_HOST,port:Number(SMTP_PORT),secure:Number(SMTP_PORT)===465,auth:{user:SMTP_USER,pass:SMTP_PASS}});
  const lines=order.items.map(i=>`${i.name} x ${i.qty} = ₹${i.price*i.qty}`).join("\n");
  await transporter.sendMail({
    from:SMTP_USER,to:BAKERY_EMAIL,subject:`New 7Layers order ${order.orderNumber}`,
    text:`New order ${order.orderNumber}\n\nCustomer: ${order.customerName}\nPhone: ${order.customerPhone}\nEmail: ${order.customerEmail||"-"}\nType: ${order.orderType}\nAddress: ${order.address||"-"}\n\n${lines}\n\nTotal: ₹${order.total}\nNotes: ${order.notes||"-"}`
  });
  return true;
}

app.get("/health",(req,res)=>res.json({ok:true,service:"7layers-bakery"}));
app.get("/api/menu",(req,res)=>res.json(JSON.parse(fs.readFileSync(MENU,"utf8"))));

app.post("/api/orders",async(req,res)=>{
  try{
    const b=req.body||{};
    if(!b.customerName||!b.customerPhone||!Array.isArray(b.items)||!b.items.length)return res.status(400).json({error:"Name, phone and at least one item are required."});
    const menu=JSON.parse(fs.readFileSync(MENU,"utf8"));
    const safeItems=b.items.map(x=>{
      const m=menu.find(i=>i.id===x.id);
      if(!m)throw new Error("Invalid menu item.");
      const qty=Math.max(1,Math.min(50,Number(x.qty)||1));
      return {id:m.id,name:m.name,price:m.price,qty};
    });
    const total=safeItems.reduce((s,i)=>s+i.price*i.qty,0);
    const order={
      id:crypto.randomUUID(),orderNumber:orderNo(),createdAt:new Date().toISOString(),
      status:"pending",customerName:String(b.customerName).slice(0,100),customerPhone:String(b.customerPhone).slice(0,30),
      customerEmail:String(b.customerEmail||"").slice(0,120),orderType:b.orderType==="Delivery"?"Delivery":"Pickup",
      address:String(b.address||"").slice(0,500),notes:String(b.notes||"").slice(0,500),items:safeItems,total
    };
    const orders=readOrders();orders.unshift(order);writeOrders(orders);
    let emailSent=false;try{emailSent=await sendEmail(order)}catch(e){console.error("Email error:",e.message)}
    res.status(201).json({...order,emailSent});
  }catch(e){res.status(400).json({error:e.message||"Could not create order."});}
});

app.get("/api/orders",adminAuth,(req,res)=>{
  let orders=readOrders();
  const from=req.query.from?new Date(req.query.from):null,to=req.query.to?new Date(req.query.to):null;
  if(from&&!isNaN(from))orders=orders.filter(o=>new Date(o.createdAt)>=from);
  if(to&&!isNaN(to))orders=orders.filter(o=>new Date(o.createdAt)<=to);
  res.json(orders);
});
app.patch("/api/orders/:id",adminAuth,(req,res)=>{
  const allowed=["pending","confirmed","preparing","ready","completed","cancelled"];
  if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid status"});
  const orders=readOrders();const o=orders.find(x=>x.id===req.params.id);
  if(!o)return res.status(404).json({error:"Order not found"});
  o.status=req.body.status;o.updatedAt=new Date().toISOString();writeOrders(orders);res.json(o);
});
app.get("/api/stats",adminAuth,(req,res)=>{
  const all=readOrders().filter(o=>o.status!=="cancelled");
  const now=new Date();
  const range=String(req.query.range||"30");
  let from=new Date(now);
  let label="Last 30 days";
  if(range==="7"){from.setDate(now.getDate()-6);label="Last 7 days";}
  else if(range==="month"){from=new Date(now.getFullYear(),now.getMonth(),1);label="This month";}
  else {from.setDate(now.getDate()-29);}
  from.setHours(0,0,0,0);
  const periodOrders=all.filter(o=>new Date(o.createdAt)>=from && new Date(o.createdAt)<=now);
  const todayKey=now.toISOString().slice(0,10);
  const todayOrders=all.filter(o=>o.createdAt.slice(0,10)===todayKey);
  const revenue=a=>a.reduce((s,o)=>s+Number(o.total||0),0);

  const daily={};
  const category={};
  const topProducts={};
  const peakHours={"9 AM":0,"11 AM":0,"1 PM":0,"3 PM":0,"5 PM":0,"7 PM":0,"9 PM":0};

  const categoryMap={puff:"Puff",burgers:"Burgers & Fries",pizza:"Pizza",shawarma:"Shawarma",rolls:"Rolls",chinese:"Chinese","bakery-item":"Bakery Items","cakes-and-pastries":"Cakes & Pastries",biscuits:"Biscuits",starters:"Starters",sandwich:"Sandwiches"};

  periodOrders.forEach(o=>{
    const day=o.createdAt.slice(0,10);daily[day]=(daily[day]||0)+Number(o.total||0);
    const hour=new Date(o.createdAt).getHours();
    let slot=hour<10?"9 AM":hour<12?"11 AM":hour<14?"1 PM":hour<16?"3 PM":hour<18?"5 PM":hour<20?"7 PM":"9 PM";
    peakHours[slot]=(peakHours[slot]||0)+1;
    o.items.forEach(i=>{
      topProducts[i.name]=(topProducts[i.name]||0)+Number(i.qty||0);
      const cat=categoryMap[i.category]||"Bakery & Snacks";
      category[cat]=(category[cat]||0)+Number(i.price||0)*Number(i.qty||0);
    });
  });
  // Fill missing days so the chart remains chronological and stable.
  const cursor=new Date(from);
  while(cursor<=now){
    const key=cursor.toISOString().slice(0,10); if(!(key in daily))daily[key]=0;
    cursor.setDate(cursor.getDate()+1);
  }
  const sortedDaily={};Object.keys(daily).sort().forEach(k=>sortedDaily[k]=daily[k]);

  res.json({
    period:{label,orders:periodOrders.length,revenue:revenue(periodOrders),average:periodOrders.length?Math.round(revenue(periodOrders)/periodOrders.length):0},
    today:{orders:todayOrders.length,revenue:revenue(todayOrders)},
    daily:sortedDaily,category,topProducts,peakHours,
    orders:periodOrders.slice(0,100)
  });
});

app.get("/admin",(req,res)=>res.sendFile(path.join(ROOT,"public","admin.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`7Layers website running on port ${PORT}`));
