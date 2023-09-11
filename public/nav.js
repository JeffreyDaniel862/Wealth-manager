let menu = document.getElementById("menu");
let x = document.getElementById("blur")
let logo = document.getElementById("logo")

function togglemenu(){
    menu.classList.toggle("open");
    x.classList.toggle("blur");
    logo.classList.toggle("color");
}

x.addEventListener("click", hideNav);

function hideNav(){
    menu.classList.remove("open")
    logo.classList.remove("color")
    x.classList.remove("blur");
}