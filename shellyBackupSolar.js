/* global Shelly, Timer, print */
// CONFIGURAÇÃO MANUAL
let LAT = 38.7223;   // Lisboa
let LON = -9.1393;   // Lisboa
let OFFSET_ON = 15;  // Minutos DEPOIS do pôr do sol
let OFFSET_OFF = -15; // Minutos ANTES do nascer do sol

function getSolarMinute(isSunrise) {
  let now = new Date();
  let dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  let pi = Math.PI;
  
  let gamma = 2 * pi / 365 * (dayOfYear - 1);
  let eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  let decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma);
  
  let ha = Math.acos(Math.cos(90.833 * pi / 180) / (Math.cos(LAT * pi / 180) * Math.cos(decl)) - Math.tan(LAT * pi / 180) * Math.tan(decl));
  if (isNaN(ha)) return null;
  
  let minutes = isSunrise 
    ? 720 - 4 * (LON + ha * 180 / pi) - eqTime 
    : 720 - 4 * (LON - ha * 180 / pi) - eqTime;
    
  let offset = now.getTimezoneOffset(); 
  return Math.round(minutes - offset);
}

// Execução a cada 60 segundos (1 minuto)
Timer.set(60000, true, function() {
  let now = new Date();
  let currentMinute = now.getHours() * 60 + now.getMinutes();
  
  let sunriseMin = getSolarMinute(true);
  let sunsetMin = getSolarMinute(false);
  
  if (sunriseMin !== null && sunsetMin !== null) {
    let targetOn = sunsetMin + OFFSET_ON;
    let targetOff = sunriseMin + OFFSET_OFF;

    // Lógica LIGAR
    if (currentMinute === targetOn) {
      Shelly.call("Switch.GetStatus", { id: 0 }, function(res) {
        if (res.output === false) {
          Shelly.call("Switch.Set", { id: 0, on: true });
          print("--- NOTIFICAÇÃO: FAIL-SAFE ATIVADO ---");
          print("Internet pode estar offline. A luz foi ligada via Script Autónomo.");
          print("Hora do Pôr do Sol calculado: " + Math.floor(sunsetMin/60) + ":" + (sunsetMin%60));
        }
      });
    }
    
    // Lógica DESLIGAR
    if (currentMinute === targetOff) {
      Shelly.call("Switch.GetStatus", { id: 0 }, function(res) {
        if (res.output === true) {
          Shelly.call("Switch.Set", { id: 0, on: false });
          print("--- NOTIFICAÇÃO: FAIL-SAFE ATIVADO ---");
          print("A luz foi desligada via Script Autónomo (Nascer do Sol).");
        }
      });
    }
  }
});

print("Script Solar Autónomo iniciado. Verificação a cada 60s.");