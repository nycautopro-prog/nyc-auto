document.getElementById("vinForm").addEventListener("submit", function(e){
  e.preventDefault();
  const vin = document.getElementById("vin").value.trim().toUpperCase();
  const status = document.getElementById("status");
  if(vin.length !== 17){
    status.textContent = "Please enter a valid 17-character VIN.";
    return;
  }
  status.textContent = "VIN received. Production checkout and report processing will be connected next.";
});
