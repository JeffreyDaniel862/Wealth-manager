export function getDate(){
    var option = {
        day : "numeric",
        month : "long",
        year: "numeric"
    };
    var day = new Date().toLocaleDateString("en-US", option);
    return day;
}

