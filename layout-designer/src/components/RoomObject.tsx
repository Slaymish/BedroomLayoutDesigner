export default function RoomObject({width = 100, height = 100 }: {width?: number, height?: number, key: number}) {
    return <div style={{ width, height, backgroundColor: 'lightgray', border: '1px solid gray', boxSizing: 'border-box' }}>
        Room Object
    </div>
}