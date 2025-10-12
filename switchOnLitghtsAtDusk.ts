/// <reference path="../../shelly-script.d.ts" />
function calculateSunTimes(date, latitude, longitude, isSunrise, zenith) {
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const cyear = date.getFullYear();
  const cmonth = date.getMonth();
  const cday = date.getDate();
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const lngHour = longitude / 15;
  const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const M = (0.9856 * t) - 3.289;
  const L = (M + (1.916 * Math.sin(M * D2R)) + (0.020 * Math.sin(2 * M * D2R)) + 282.634) % 360;
  const RA = (R2D * Math.atan(0.91764 * Math.tan(L * D2R))) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  const RAcorrected = (RA + (Lquadrant - RAquadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(L * D2R);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * D2R) - (sinDec * Math.sin(latitude * D2R))) / (cosDec * Math.cos(latitude * D2R));

  if (cosH > 1 || cosH < -1) {
    return null; // O sol não nasce ou não se põe nesta data e localização
  }

  const H = (isSunrise ? 360 - R2D * Math.acos(cosH) : R2D * Math.acos(cosH)) / 15;
  const T = H + RAcorrected - (0.06571 * t) - 6.622;
  const UT = (T - lngHour) % 24;

  const hours = Math.floor(UT);
  const minutes = Math.floor((UT % 1) * 60);
  const seconds = Math.floor((((UT % 1) * 60) % 1) * 60);

  console.log("isSunrise: " + isSunrise + ", H: " + H + ", T: " + T + ", UT: " + UT + ", Hours: " + hours + ", Minutes: " + minutes + ", Seconds: " + seconds);

  // Verificar se precisamos ajustar a data para o próximo dia
  let resultDate = new Date(cyear, cmonth, cday, hours, minutes, seconds);
  if (!isSunrise && UT < 0) {
    resultDate = new Date(cyear, cmonth, cday + 1, hours, minutes, seconds);
  }

  return resultDate;
}



function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
}

function formatDate(date) {
  let day = date.getDate();
  let month = date.getMonth() + 1; // Os meses são indexados a partir de 0
  let year = date.getFullYear();
  return (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month + '/' + year;
}

function printDate(date) {
  return formatDate(date) + ' ' + formatTime(date);
}

function main() {
  //lat-long for Santa Cruz Village
  let lat = 39.140886;
  let long = -9.367881
  let now = new Date();
  //let now = new Date(2024, 1, 23, 20, 0, 5);
  let currentTime = now;
  let sunrise = calculateSunTimes(now, lat, long, true, 90.8333);
  let sunset = calculateSunTimes(now, lat, long, false, 90.8333);

  //adjusted zenith to 3 degrees before dawn or dusk to ensure that there is some light yet
  //added 1 degree more to save 5 more minutes
  let civilDawn = calculateSunTimes(now, lat, long, true, 94);
  let civilDusk = calculateSunTimes(now, lat, long, false, 94);

  if (sunrise && sunset && civilDawn && civilDusk) {
    print("Current Time: " + printDate(now));
    print("Sunrise: " + printDate(sunrise));
    print("Sunset: " + printDate(sunset));
    print("Civil Dawn: " + printDate(civilDawn));

    //print("Civil Dusk date: " + civilDusk.getDate());
    //print("NOW: " + now.getDate());

    if (civilDusk.getDate() != now.getDate()) {
      //print("erro no civilDusk");
      civilDusk = new Date(now.getFullYear(), now.getMonth(), now.getDate(), civilDusk.getHours(), civilDusk.getMinutes(), civilDusk.getSeconds());
      print("Civil Dusk Fixed: " + printDate(civilDusk));
    }
    else {
      print("Civil Dusk: " + printDate(civilDusk));
    }

    if (currentTime > civilDusk || currentTime < civilDawn) {
      print("Switch ON");
      Shelly.call("Switch.Set", { id: 0, on: true });
    } else if (currentTime > civilDawn && currentTime < civilDusk) {
      print("Switch OFF");
      Shelly.call("Switch.Set", { id: 0, on: false });
    }
  } else {
    print("Sunrise, Sunset, Civil Dawn, or Civil Dusk calculation error.");
  }
}

Timer.set(
  15000,
  true,
  main
);
