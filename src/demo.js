const bikes = ['Szosa Miedziana', 'Gravel Borówka', 'Miejski Zefir'];
const names = ['Spokojna pętla', 'Górski poranek', 'Do kawiarni', 'Po pracy', 'Niedzielny objazd'];

export const demoRides = Array.from({length: 60}, (_, index) => {
  const bike = index % bikes.length;
  const year = 2023 + Math.floor(index / 20);
  const month = String(index % 12 + 1).padStart(2, '0');
  const distance = 5000 + (index * 7333) % 123000;
  return {
    id: `demo-${index + 1}`, date: `${year}-${month}-${String(1 + index % 23).padStart(2, '0')}`,
    name: names[index % names.length], bike: index % 17 === 0 ? null : bikes[bike],
    distance_m: distance, moving_seconds: distance / (bike === 2 ? 4.5 : 7.1),
    elevation_m: Math.round(distance / (100 + bike * 80)),
    watts: bike === 2 ? null : 120 + index % 70,
    normalized_watts: bike === 2 ? null : 132 + index % 76,
    heart_rate: bike === 2 ? null : 125 + index % 28,
    url: '', secondary: false, dual_role: null, power_meter: null,
  };
});
