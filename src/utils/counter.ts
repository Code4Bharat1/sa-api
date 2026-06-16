import mongoose, { Schema } from 'mongoose';

const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', CounterSchema);

export const getNextSequence = async (name: string): Promise<number> => {
  const result = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result!.seq;
};

export const generateTicketId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`ticket_${year}`);
  return `TKT-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateCustomerId = async (): Promise<string> => {
  const seq = await getNextSequence('customer');
  return `CUST-${String(seq).padStart(5, '0')}`;
};
