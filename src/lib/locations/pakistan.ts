export const PAKISTAN_STATE_CITIES = [
  {
    state: 'Punjab',
    cities: [
      'Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Multan',
      'Sialkot', 'Bahawalpur', 'Sargodha', 'Sheikhupura', 'Rahim Yar Khan',
      'Jhang', 'Dera Ghazi Khan', 'Gujrat', 'Sahiwal', 'Okara',
    ],
  },
  {
    state: 'Sindh',
    cities: [
      'Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah',
      'Mirpur Khas', 'Jacobabad', 'Shikarpur', 'Thatta',
    ],
  },
  {
    state: 'Khyber Pakhtunkhwa',
    cities: [
      'Peshawar', 'Mardan', 'Mingora', 'Abbottabad', 'Kohat',
      'Dera Ismail Khan', 'Bannu', 'Mansehra', 'Swabi',
    ],
  },
  {
    state: 'Balochistan',
    cities: ['Quetta', 'Gwadar', 'Turbat', 'Khuzdar', 'Chaman', 'Sibi', 'Zhob'],
  },
  {
    state: 'Islamabad Capital Territory',
    cities: ['Islamabad'],
  },
  {
    state: 'Azad Jammu and Kashmir',
    cities: ['Muzaffarabad', 'Mirpur', 'Kotli', 'Bagh'],
  },
  {
    state: 'Gilgit-Baltistan',
    cities: ['Gilgit', 'Skardu', 'Hunza', 'Chilas'],
  },
] as const

export const PAKISTAN_CITIES = PAKISTAN_STATE_CITIES.flatMap(group =>
  group.cities.map(city => ({ state: group.state, city }))
)
