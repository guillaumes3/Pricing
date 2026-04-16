import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number.parseFloat(value),
};

@Entity({ name: 'price_history' })
@Index(['productId', 'recordedAt'])
export class PriceHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id', type: 'integer' })
  productId!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  price!: number;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency!: string;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;
}
