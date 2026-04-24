export type ThiingsItem = {
  id: string
  image: string
  name: string
  description: string
  tags: string[]
  model?: string
  modelPoster?: string
}

export const thiingsItems: ThiingsItem[] = [
  {
    id: '1',
    image: '/thiings/1.png',
    name: 'Umbrella',
    description:
      'A portable device used for protection against rain or sunlight, typically consisting of a circular fabric canopy mounted on a folding metal frame with a central handle.',
    tags: ['everyday life', 'personal care', 'weather', 'outdoor'],
    model: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
  },
  {
    id: '2',
    image: '/thiings/2.png',
    name: 'Coffee Cup',
    description:
      'A small ceramic vessel with a handle, designed for serving hot beverages like coffee or tea. A daily companion for millions around the world.',
    tags: ['kitchen', 'beverage', 'everyday life']
  },
  {
    id: '3',
    image: '/thiings/3.png',
    name: 'Camera',
    description:
      'A device that captures light through a lens and records images onto a sensor or film, preserving moments in time as photographs or video.',
    tags: ['technology', 'photography', 'hobby'],
    model: 'https://modelviewer.dev/shared-assets/models/reflective-sphere.gltf'
  },
  {
    id: '4',
    image: '/thiings/4.png',
    name: 'Headphones',
    description:
      'A pair of small speakers worn over or inside the ears, letting you listen to audio privately without disturbing anyone nearby.',
    tags: ['technology', 'audio', 'music']
  },
  {
    id: '5',
    image: '/thiings/5.png',
    name: 'Backpack',
    description:
      'A bag with shoulder straps worn on the back, used to carry books, gear, or travel essentials with both hands free.',
    tags: ['travel', 'school', 'outdoor', 'everyday life'],
    model: '/thiings/5.stl'
  },
  {
    id: '6',
    image: '/thiings/6.png',
    name: 'Alarm Clock',
    description:
      'A timepiece designed to ring or buzz at a set time, traditionally used to wake people from sleep at the start of a new day.',
    tags: ['home', 'time', 'bedroom']
  },
  {
    id: '7',
    image: '/thiings/7.png',
    name: 'Gift Box',
    description:
      'A decorative container wrapped with ribbon or paper, holding a present for a special occasion like a birthday, holiday, or celebration.',
    tags: ['celebration', 'holiday', 'present']
  },
  {
    id: '8',
    image: '/thiings/8.png',
    name: 'Lantern',
    description:
      'A portable light source enclosed in a transparent case, used to illuminate dark spaces or set a warm mood indoors and outdoors.',
    tags: ['home', 'light', 'outdoor', 'decor']
  },
  {
    id: '9',
    image: '/thiings/9.png',
    name: 'Plant Pot',
    description:
      'A container filled with soil that holds a living plant, bringing a bit of nature into homes, offices, and gardens.',
    tags: ['home', 'nature', 'decor', 'garden']
  }
]

export function getThiingsItem(id: string): ThiingsItem | undefined {
  return thiingsItems.find((item) => item.id === id)
}

export function getThiingsItemByGridIndex(gridIndex: number): ThiingsItem {
  const len = thiingsItems.length
  const idx = ((gridIndex % len) + len) % len
  return thiingsItems[idx]!
}
