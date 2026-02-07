/// <reference path="../../shelly-script.d.ts" />

/**
 * Script de Automação de Iluminação Exterior - Shelly 1 PM Mini
 * 
 * Funcionalidade:
 * - Liga as luzes ao crepúsculo civil (quando ainda há luz natural)
 * - Desliga as luzes à madrugada civil (quando começa a amanhecer)
 * - Calcula automaticamente os tempos com base na data, localização (latitude/longitude)
 * - Executa verificação a cada 15 segundos
 * 
 * Localização padrão: Santa Cruz Village, Lisboa
 * Coordenadas: 39.140886, -9.367881
 */

/**
 * Calcula o tempo de nascimento ou pôr do sol usando algoritmo astronômico
 * 
 * @param {Date} date - Data para cálculo
 * @param {number} latitude - Latitude em graus decimais
 * @param {number} longitude - Longitude em graus decimais
 * @param {boolean} isSunrise - true para nascimento, false para pôr
 * @param {number} zenith - Ângulo do horizonte (90.8333° = oficial, 94° = civil)
 * @returns {Date|null} Data e hora do evento, ou null se o sol não nasce/se põe
 * 
 * Explicação dos zenith:
 * - 90.8333°: Nascimento/Pôr oficial do sol
 * - 94°: Crepúsculo/Madrugada civil (luz ainda visível)
 */
function calculateSunTimes(date, latitude, longitude, isSunrise, zenith) {
  // Conversão entre graus e radianos
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  
  // Extração da data
  const cyear = date.getFullYear();
  const cmonth = date.getMonth();
  const cday = date.getDate();
  
  // Cálculo do dia do ano
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  
  // Ajuste pela longitude (diferença de fuso horário)
  const lngHour = longitude / 15;
  
  // Parâmetro temporal para o cálculo
  const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
  
  // Anomalia média solar
  const M = (0.9856 * t) - 3.289;
  
  // Longitude eclíptica do sol
  const L = (M + (1.916 * Math.sin(M * D2R)) + (0.020 * Math.sin(2 * M * D2R)) + 282.634) % 360;
  
  // Ascensão reta (RA)
  const RA = (R2D * Math.atan(0.91764 * Math.tan(L * D2R))) % 360;
  
  // Ajuste de quadrante para longitude
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  const RAcorrected = (RA + (Lquadrant - RAquadrant)) / 15;
  
  // Declinação solar
  const sinDec = 0.39782 * Math.sin(L * D2R);
  const cosDec = Math.cos(Math.asin(sinDec));
  
  // Ângulo horário
  const cosH = (Math.cos(zenith * D2R) - (sinDec * Math.sin(latitude * D2R))) / (cosDec * Math.cos(latitude * D2R));

  // Validação: impossível calcular se cosH está fora do intervalo [-1, 1]
  if (cosH > 1 || cosH < -1) {
    return null; // O sol não nasce ou não se põe nesta data e localização
  }

  const H = (isSunrise ? 360 - R2D * Math.acos(cosH) : R2D * Math.acos(cosH)) / 15;
  const T = H + RAcorrected - (0.06571 * t) - 6.622;
  const UT = (T - lngHour) % 24;

  // Conversão do tempo até às horas:minutos:segundos
  const hours = Math.floor(UT);
  const minutes = Math.floor((UT % 1) * 60);
  const seconds = Math.floor((((UT % 1) * 60) % 1) * 60);

  console.log("isSunrise: " + isSunrise + ", H: " + H + ", T: " + T + ", UT: " + UT + ", Hours: " + hours + ", Minutes: " + minutes + ", Seconds: " + seconds);

  // Criar data com o resultado
  let resultDate = new Date(cyear, cmonth, cday, hours, minutes, seconds);
  
  // Ajuste se o pôr do sol resultar em hora negativa (próximo dia)
  if (!isSunrise && UT < 0) {
    resultDate = new Date(cyear, cmonth, cday + 1, hours, minutes, seconds);
  }

  return resultDate;
}


/**
 * Formata uma data em formato HH:MM
 * @param {Date} date - Data a formatar
 * @returns {string} Tempo formatado (ex: "14:30")
 */
function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
}

/**
 * Formata uma data em formato DD/MM/YYYY
 * @param {Date} date - Data a formatar
 * @returns {string} Data formatada (ex: "07/02/2026")
 */
function formatDate(date) {
  let day = date.getDate();
  let month = date.getMonth() + 1; // Os meses são indexados a partir de 0
  let year = date.getFullYear();
  return (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month + '/' + year;
}

/**
 * Formata uma data completa em formato DD/MM/YYYY HH:MM
 * @param {Date} date - Data a formatar
 * @returns {string} Data e hora formatadas (ex: "07/02/2026 14:30")
 */
function printDate(date) {
  return formatDate(date) + ' ' + formatTime(date);
}

/**
 * Função principal de controle de iluminação
 * 
 * Lógica:
 * 1. Calcula os tempos de nascimento e pôr do sol oficial (90.8333°)
 * 2. Calcula os tempos de madrugada e crepúsculo civil (94°)
 * 3. Compara a hora atual com os tempos calculados
 * 4. Liga as luzes fora do período de luz (após crepúsculo ou antes da madrugada)
 * 5. Desliga as luzes durante o período de luz (entre madrugada e crepúsculo)
 * 
 * O crepúsculo civil oferece um intervalo de segurança:
 * - Não liga logo que escurece (espera até haver menos luz ambiente)
 * - Não desliga logo que amanheça (mantém luzes até haver luz natural suficiente)
 */
function main() {
  // Coordenadas de Santa Cruz Village, Lisboa
  let lat = 39.140886;
  let long = -9.367881;
  
  // Data/hora atual
  let now = new Date();
  // Alternativa para teste: let now = new Date(2024, 1, 23, 20, 0, 5);
  let currentTime = now;
  
  // Cálculo de eventos solares officiaiszenith = 90.8333°)
  let sunrise = calculateSunTimes(now, lat, long, true, 90.8333);
  let sunset = calculateSunTimes(now, lat, long, false, 90.8333);
  
  // Cálculo de eventos solares em período civil (zenith = 94°)
  // - Madrugada civil: quando há luz natural no amanhecer
  // - Crepúsculo civil: quando há luz natural no anoitecer
  let civilDawn = calculateSunTimes(now, lat, long, true, 94);
  let civilDusk = calculateSunTimes(now, lat, long, false, 94);

  // Validação: todos os cálculos devem ser bem-sucedidos
  if (sunrise && sunset && civilDawn && civilDusk) {
    print("Current Time: " + printDate(now));
    print("Sunrise: " + printDate(sunrise));
    print("Sunset: " + printDate(sunset));
    print("Civil Dawn: " + printDate(civilDawn));

    // Correção se o crepúsculo civil cair no próximo dia
    // (pode acontecer perto das 00:00 em latitudes extremas)
    if (civilDusk.getDate() != now.getDate()) {
      civilDusk = new Date(now.getFullYear(), now.getMonth(), now.getDate(), civilDusk.getHours(), civilDusk.getMinutes(), civilDusk.getSeconds());
      print("Civil Dusk Fixed: " + printDate(civilDusk));
    }
    else {
      print("Civil Dusk: " + printDate(civilDusk));
    }

    // Lógica de controle: ligar após crepúsculo ou antes de madrugada
    if (currentTime > civilDusk || currentTime < civilDawn) {
      print("Switch ON");
      // Controlador: Switch com ID 0 (relay do Shelly 1 PM Mini)
      Shelly.call("Switch.Set", { id: 0, on: true });
    } 
    // Lógica de controle: desligar durante o dia (entre madrugada e crepúsculo)
    else if (currentTime > civilDawn && currentTime < civilDusk) {
      print("Switch OFF");
      Shelly.call("Switch.Set", { id: 0, on: false });
    }
  } else {
    print("Sunrise, Sunset, Civil Dawn, or Civil Dusk calculation error.");
  }
}

/**
 * Agendador de execução
 * 
 * Executa a função main() a cada 15 segundos
 * - Intervalo: 15000 ms (15 segundos)
 * - Repetido: true (execução contínua enquanto o Shelly estiver ligado)
 * 
 * Isto garante que:
 * - As luzes respondem rapidamente a mudanças no estado (ex: manual override)
 * - O horário é verificado frequentemente
 * - O cálculo se efectua diariamente com base na data/hora actual do Shelly
 */
Timer.set(
  15000,  // Intervalo em millisegundos
  true,   // Repetir continuamente
  main    // Função a executar
);
