import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'google_geo_targets' })
@Index('idx_geo_targets_country', ['countryCode'])
@Index('idx_geo_targets_parent', ['parentId'])
@Index('idx_geo_targets_type', ['targetType'])
@Index('idx_geo_targets_status', ['status'])
export class GoogleGeoTarget {
  /** Criteria ID из CSV — используем как PK, чтобы не плодить surrogate id */
  @PrimaryColumn({ type: 'bigint', name: 'criteria_id' })
  criteriaId!: number;

  /** Name (короткое имя, напр. "Kabul") */
  @Column({ type: 'varchar', length: 255, name: 'name' })
  name!: string;

  /** Canonical Name (иерархия через запятую: "Kabul,Kabul,Afghanistan") */
  @Column({ type: 'varchar', length: 512, name: 'canonical_name' })
  canonicalName!: string;

  /** Parent ID (ссылка на criteria_id родителя) */
  @Column({ type: 'bigint', name: 'parent_id', nullable: true })
  parentId!: number | null;

  /** ISO-код страны (обычно 2 символа, но оставим до 3 на всякий) */
  @Column({ type: 'varchar', length: 3, name: 'country_code', nullable: true })
  countryCode!: string | null;

  /** Target Type (City/Region/Country/...); храним строкой, т.к. набор большой */
  @Column({ type: 'varchar', length: 32, name: 'target_type' })
  targetType!: string;

  /** Status (Active/Obsolete) */
  @Column({ type: 'varchar', length: 16, name: 'status' })
  status!: string;
}
