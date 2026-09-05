<script setup lang="ts">
/** 图书录入 / 编辑（PRD 3.3.2 / 3.3.3）— 同一表单复用 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useBooksStore } from '@/stores/books'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const formRef = ref<FormInstance>()

const editId = computed(() => (route.name === 'book-edit' ? Number(route.params.id) : null))
const editing = computed(() => (editId.value ? booksStore.getById(editId.value) : undefined))
const isBorrowedBook = computed(() => editing.value?.status === 'borrowed')

const form = reactive({
  title: '',
  author: '',
  isbn: '',
  category: '武侠',
  price: undefined as number | undefined,
  dailyRent: undefined as number | undefined,
  deposit: undefined as number | undefined,
  location: '',
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入书名', trigger: 'blur' }],
  author: [{ required: true, message: '请输入作者', trigger: 'blur' }],
  isbn: [
    { required: true, message: '请输入 ISBN', trigger: 'blur' },
    { pattern: /^[\dXx-]{10,17}$/, message: 'ISBN 格式不正确', trigger: 'blur' },
  ],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入定价', trigger: 'blur' }, { type: 'number', min: 0.01, message: '定价需大于 0', trigger: 'blur' }],
  dailyRent: [{ required: true, message: '请输入日租金', trigger: 'blur' }, { type: 'number', min: 0.01, message: '日租金需大于 0', trigger: 'blur' }],
  deposit: [{ required: true, message: '请输入押金', trigger: 'blur' }, { type: 'number', min: 0, message: '押金不能为负', trigger: 'blur' }],
}

onMounted(() => {
  if (!editing.value) return
  Object.assign(form, {
    title: editing.value.title,
    author: editing.value.author,
    isbn: editing.value.isbn,
    category: editing.value.category,
    price: editing.value.price,
    dailyRent: editing.value.dailyRent,
    deposit: editing.value.deposit,
    location: editing.value.location,
  })
})

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (editId.value) {
    // 编辑：借出中的图书仅允许更新位置（PRD 3.3.3）
    const payload = isBorrowedBook.value ? { location: form.location } : { ...form }
    const result = booksStore.update(editId.value, payload)
    if (result.code === 0) {
      ElMessage.success('图书信息已更新')
      router.push('/books')
    } else ElMessage.error(result.message)
  } else {
    const result = booksStore.create({
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      category: form.category,
      price: Number(form.price),
      dailyRent: Number(form.dailyRent),
      deposit: Number(form.deposit),
      location: form.location.trim() || '待上架',
    })
    if (result.code === 0) {
      ElMessage.success(`《${result.data!.title}》录入成功`)
      router.push('/books')
    } else ElMessage.error(result.message)
  }
}
</script>

<template>
  <div class="page-card" style="max-width: 720px">
    <h3 class="page-title">{{ editId ? '编辑图书' : '录入新图书' }}</h3>
    <el-alert v-if="isBorrowedBook" type="warning" :closable="false" title="该图书当前借出中，仅可更新书架位置" class="mb16" />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="书名" prop="title">
        <el-input v-model="form.title" :disabled="isBorrowedBook" placeholder="如：笑傲江湖" />
      </el-form-item>
      <el-form-item label="作者" prop="author">
        <el-input v-model="form.author" :disabled="isBorrowedBook" placeholder="如：金庸" />
      </el-form-item>
      <el-form-item label="ISBN" prop="isbn">
        <el-input v-model="form.isbn" :disabled="isBorrowedBook" placeholder="10-17 位 ISBN 编号" />
      </el-form-item>
      <el-form-item label="分类" prop="category">
        <el-select v-model="form.category" :disabled="isBorrowedBook" style="width: 100%">
          <el-option v-for="c in ['武侠', '言情', '科幻', '悬疑', '历史']" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>
      <el-form-item label="定价（元）" prop="price">
        <el-input-number v-model="form.price" :min="0.01" :precision="2" :step="1" :disabled="isBorrowedBook" style="width: 100%" />
      </el-form-item>
      <el-form-item label="日租金（元）" prop="dailyRent">
        <el-input-number v-model="form.dailyRent" :min="0.01" :precision="2" :step="0.1" :disabled="isBorrowedBook" style="width: 100%" />
      </el-form-item>
      <el-form-item label="押金（元）" prop="deposit">
        <el-input-number v-model="form.deposit" :min="0" :precision="2" :step="5" :disabled="isBorrowedBook" style="width: 100%" />
      </el-form-item>
      <el-form-item label="书架位置">
        <el-input v-model="form.location" placeholder="如：A-01-03" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" class="gold-btn" @click="submit">{{ editId ? '保存修改' : '确认录入' }}</el-button>
        <el-button @click="router.push('/books')">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.mb16 { margin-bottom: 16px; }
</style>
