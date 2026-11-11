import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'google_city_coords' })
export class GoogleCityCoords {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'bigint' })
  lr: number;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;
}
