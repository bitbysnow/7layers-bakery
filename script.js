
const CART_KEY="7layers_cart_v5";
const WHATSAPP_NUMBER="919030333177";
let cart=JSON.parse(localStorage.getItem(CART_KEY)||"{}");

const money=n=>"₹"+Number(n).toLocaleString("en-IN");
const cartCount=()=>Object.values(cart).reduce((s,i)=>s+i.qty,0);
const cartTotal=()=>Object.values(cart).reduce((s,i)=>s+i.price*i.qty,0);
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(cart));updateCartUI();}
function updateCartUI(){
  const summary=document.getElementById("cartSummary");
  if(summary) summary.textContent=`${cartCount()} item${cartCount()===1?"":"s"} • ${money(cartTotal())}`;
  const box=document.getElementById("cartItems"), total=document.getElementById("cartTotal");
  if(!box)return;
  const rows=Object.values(cart);
  box.innerHTML=rows.length?rows.map(i=>`
    <div class="cart-row">
      <div><h4>${escapeHtml(i.name)}</h4><small>${money(i.price)} each</small></div>
      <div class="qty"><button type="button" data-minus="${i.id}">−</button><span>${i.qty}</span><button type="button" data-plus="${i.id}">+</button></div>
      <div class="cart-row-total">${money(i.price*i.qty)}</div>
    </div>`).join(""):'<div class="empty-cart">Your order is empty.<br>Add something delicious from the menu.</div>';
  if(total)total.textContent=money(cartTotal());
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function openCart(){document.getElementById("cartModal").classList.add("open");document.getElementById("cartModal").setAttribute("aria-hidden","false");updateCartUI();}
function closeCart(){document.getElementById("cartModal").classList.remove("open");document.getElementById("cartModal").setAttribute("aria-hidden","true");}

document.addEventListener("click",e=>{
  const add=e.target.closest(".add-btn");
  if(add){
    const item=add.closest(".menu-item");
    const name=item.querySelector("h4").childNodes[0].textContent.trim();
    const price=Number((item.querySelector(".menu-price strong")||item.querySelector("strong")).textContent.replace(/[^\d]/g,""));
    const id=name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
    cart[id]=cart[id]||{id,name,price,qty:0};cart[id].qty++;saveCart();
    add.textContent="Added ✓";setTimeout(()=>add.textContent="+ Add",800);
  }
  const plus=e.target.closest("[data-plus]"),minus=e.target.closest("[data-minus]");
  if(plus){cart[plus.dataset.plus].qty++;saveCart();}
  if(minus){cart[minus.dataset.minus].qty--;if(cart[minus.dataset.minus].qty<=0)delete cart[minus.dataset.minus];saveCart();}
  if(e.target.id==="viewCartBtn")openCart();
  if(e.target.matches("[data-close-cart]"))closeCart();
});

document.getElementById("orderType")?.addEventListener("change",e=>{
  const delivery=e.target.value==="Delivery";
  document.getElementById("addressField").classList.toggle("hidden",!delivery);
  document.getElementById("customerAddress").required=delivery;
});

function collectOrder(){
  return {
    customerName:document.getElementById("customerName").value.trim(),
    customerPhone:document.getElementById("customerPhone").value.trim(),
    customerEmail:document.getElementById("customerEmail").value.trim(),
    orderType:document.getElementById("orderType").value,
    address:document.getElementById("customerAddress").value.trim(),
    notes:document.getElementById("orderNotes").value.trim(),
    items:Object.values(cart).map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty})),
    total:cartTotal()
  };
}
async function saveOrder(){
  const order=collectOrder();
  if(!order.items.length)throw new Error("Please add at least one item.");
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(order)});
  if(!r.ok)throw new Error("Could not save the order. Please try again.");
  return r.json();
}
function waMessage(order){
  const lines=order.items.map(i=>`• ${i.name} × ${i.qty} = ${money(i.price*i.qty)}`).join("\n");
  return `Hello 7Layers Bakery & Snacks!\n\nI would like to place an order.\n\nName: ${order.customerName}\nPhone: ${order.customerPhone}${order.customerEmail?`\nEmail: ${order.customerEmail}`:""}\nOrder type: ${order.orderType}\n\n${lines}\n\nTotal: ${money(order.total)}${order.orderType==="Delivery"?`\nAddress: ${order.address}`:""}${order.notes?`\nNotes: ${order.notes}`:""}`;
}
async function submitOrder(method){
  try{
    const order=await saveOrder();
    const msg=waMessage(order);
    if(method==="whatsapp"){
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
    } else {
      // The server sends the configured bakery notification email. This opens a customer
      // mail composer as an additional fallback, using the bakery address from config.
      window.open(`mailto:?subject=${encodeURIComponent("7Layers Order "+order.orderNumber)}&body=${encodeURIComponent(msg)}`,"_blank");
      alert("Your order has been saved. Your email app has been opened as a backup. If bakery email is configured on the server, the bakery will also receive an automatic notification.");
    }
    cart={};saveCart();closeCart();
  }catch(err){alert(err.message||"Something went wrong.");}
}
document.getElementById("orderForm")?.addEventListener("submit",e=>{e.preventDefault();submitOrder("whatsapp");});
document.getElementById("orderEmailBtn")?.addEventListener("click",()=>submitOrder("email"));

/* Menu category/search filtering */
const menuTabs=document.querySelectorAll(".menu-tab"),menuGroups=document.querySelectorAll(".menu-group"),menuSearch=document.getElementById("menuSearch");
function filterMenu(){
  const active=document.querySelector(".menu-tab.active")?.dataset.filter||"all",q=(menuSearch?.value||"").trim().toLowerCase();
  menuGroups.forEach(g=>{
    const catOk=active==="all"||g.dataset.category===active;let count=0;
    g.querySelectorAll(".menu-item").forEach(i=>{const ok=!q||i.innerText.toLowerCase().includes(q);i.style.display=ok?"flex":"none";if(ok)count++;});
    g.style.display=catOk&&count?"block":"none";
  });
}
menuTabs.forEach(t=>t.addEventListener("click",()=>{menuTabs.forEach(x=>x.classList.remove("active"));t.classList.add("active");filterMenu();}));
menuSearch?.addEventListener("input",filterMenu);
updateCartUI();
