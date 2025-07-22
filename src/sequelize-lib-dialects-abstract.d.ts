declare module 'sequelize/lib/dialects/abstract' {
  import { Dialect } from 'sequelize';
  export class AbstractDialect extends Dialect {}
  export default AbstractDialect;
} 